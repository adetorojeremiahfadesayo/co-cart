import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

function isPublicIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false; // current host, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // IETF protocol assignments (incl. 192.0.2.0/24 documentation)
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return false; // documentation
  if (a === 203 && b === 0 && parts[2] === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function isPublicIpv6(normalized: string): boolean {
  const lower = normalized.toLowerCase();
  if (lower === "::" || lower === "::1") return false; // unspecified, loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe90:") || lower.startsWith("fea0:") || lower.startsWith("feb0:")) return false; // link-local fe80::/10
  if (/^f[cd]/.test(lower)) return false; // unique-local fc00::/7
  if (lower.startsWith("ff")) return false; // multicast ff00::/8
  if (lower.startsWith("2001:db8:")) return false; // documentation
  if (lower.startsWith("64:ff9b:")) return false; // NAT64 well-known prefix
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (mapped) return isPublicAddress(mapped[1]);
  return true;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return isPublicIpv4(parts);
  }
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function resolvePublicHostname(hostname: string): Promise<string[]> {
  const directFamily = isIP(hostname);
  if (directFamily) {
    if (!isPublicAddress(hostname)) throw new Error("That address points at a private or reserved network.");
    return [hostname];
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The link's host could not be resolved.");
  }
  if (!addresses.length) throw new Error("The link's host could not be resolved.");
  if (addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error("That address points at a private or reserved network.");
  }
  return addresses.map((entry) => entry.address);
}

export interface FetchedPage {
  finalUrl: string;
  contentType: string;
  text: string;
}

async function fetchFromValidatedAddress(url: URL, addresses: string[], signal: AbortSignal): Promise<{ response: Response; dispatcher: Agent }> {
  let lastError: unknown;
  for (const address of addresses) {
    const family = isIP(address) as 4 | 6;
    const dispatcher = new Agent({
      connect: {
        // Bind the socket to the address that passed the public-network check.
        // TLS still uses url.hostname for SNI and certificate verification.
        lookup: ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        }) as never,
      },
    });
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "user-agent": "CoCartProductInspector/1.0",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
        dispatcher,
      } as unknown as RequestInit & { dispatcher: Agent });
      return { response, dispatcher };
    } catch (error) {
      lastError = error;
      await dispatcher.close().catch(() => undefined);
      if (signal.aborted) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The linked page could not be reached.");
}

async function readLimitedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (!truncated) {
    if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("The page inspection timed out.");
    const { value, done } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      // Real product pages are often large; the facts we need live in the
      // document head, so keep the leading bytes and stop downloading.
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    total += value.byteLength;
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// Fetches one public https page with SSRF protections: DNS is resolved and
// validated before every request and redirect, redirects are capped, private
// and reserved ranges are rejected, and body size and total time are limited.
// No caller cookies, authorization headers, or secrets are ever forwarded.
export async function fetchPublicPage(
  urlString: string,
  options: { maxRedirects?: number; maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchedPage> {
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;
  const deadline = Date.now() + (options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("The page inspection timed out.")), Math.max(1, deadline - Date.now()));

  try {
    let current = new URL(urlString);
    if (current.protocol !== "https:") throw new Error("Only https:// product links can be inspected.");
    if (current.username || current.password) throw new Error("Product links containing credentials are not accepted.");
    if (current.port && current.port !== "443") throw new Error("Product links must use the standard secure HTTPS port.");

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const validatedAddresses = await resolvePublicHostname(current.hostname);
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("The page inspection timed out.");
      let response: Response;
      let dispatcher: Agent | null = null;
      try {
        ({ response, dispatcher } = await fetchFromValidatedAddress(current, validatedAddresses, controller.signal));
      } catch (error) {
        if (controller.signal.aborted) throw new Error("The page inspection timed out.");
        throw error instanceof Error ? error : new Error("The linked page could not be reached.");
      }
      try {
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error("The linked page redirected without a destination.");
          const next = new URL(location, current);
          if (next.protocol !== "https:") throw new Error("The link redirects to a non-https address, which is not allowed.");
          if (next.username || next.password) throw new Error("The link redirects to embedded credentials, which is not allowed.");
          if (next.port && next.port !== "443") throw new Error("The link redirects to a non-standard HTTPS port, which is not allowed.");
          if (hop === maxRedirects) throw new Error("The link redirects too many times to inspect safely.");
          await response.body?.cancel().catch(() => undefined);
          current = next;
          continue;
        }

        if (!response.ok) throw new Error(`The linked page responded with HTTP ${response.status}.`);
        const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
        if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml")) {
          throw new Error("The linked page is not an HTML product page.");
        }
        const text = await readLimitedBody(response, maxBytes, controller.signal);
        return { finalUrl: current.toString(), contentType, text };
      } finally {
        await dispatcher?.close().catch(() => undefined);
      }
    }
    throw new Error("The link redirects too many times to inspect safely.");
  } finally {
    clearTimeout(timer);
  }
}

const SKIP_TAGS = ["script", "style", "noscript", "template", "svg"];

// Linear scanner: strips tags and skips script/style bodies without regex
// backtracking, so multi-megabyte product pages stay cheap to process.
function htmlToText(html: string, maxLength = 4000): string {
  let out = "";
  let cursor = 0;
  while (cursor < html.length && out.length < maxLength) {
    const open = html.indexOf("<", cursor);
    if (open === -1) {
      out += html.slice(cursor, cursor + (maxLength - out.length));
      break;
    }
    out += html.slice(cursor, Math.min(open, cursor + (maxLength - out.length)));
    const close = html.indexOf(">", open);
    if (close === -1) break;
    const isClosing = html[open + 1] === "/";
    const isSelfClosing = html[close - 1] === "/";
    const tagName = html.slice(open + (isClosing ? 2 : 1), open + 10).toLowerCase();
    const skip = SKIP_TAGS.find((tag) => tagName.startsWith(tag));
    if (skip && !isClosing && !isSelfClosing) {
      const closing = html.toLowerCase().indexOf(`</${skip}>`, close + 1);
      cursor = closing === -1 ? html.length : closing + skip.length + 3;
      continue;
    }
    cursor = close + 1;
  }
  return out;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, pattern: RegExp, max: number): string | null {
  const match = pattern.exec(html);
  if (!match?.[1]) return null;
  const decoded = decodeEntities(match[1]);
  return decoded ? decoded.slice(0, max) : null;
}

export interface InspectedPageFacts {
  finalUrl: string;
  title?: string;
  description?: string;
  productName?: string;
  brand?: string;
  priceAmount?: string;
  priceCurrency?: string;
  imageUrl?: string;
  textSnippet?: string;
}

// Extracts just enough page metadata to build an editable product reference.
// Everything returned is untrusted data, never instructions.
export function extractPageFacts(page: FetchedPage): InspectedPageFacts {
  const html = page.text;
  const facts: InspectedPageFacts = { finalUrl: page.finalUrl };

  facts.title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i, 300) ?? undefined;
  facts.description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, 600)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, 600)
    ?? firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i, 600)
    ?? undefined;
  facts.productName = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i, 300) ?? undefined;
  const ogImage = firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i, 2048);
  if (ogImage && ogImage.startsWith("https://")) facts.imageUrl = ogImage;

  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        const object = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
        if (!object) continue;
        const type = object["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;
        if (typeof object.name === "string" && object.name.trim()) facts.productName = facts.productName ?? object.name.trim().slice(0, 300);
        const brand = object.brand && typeof object.brand === "object" ? (object.brand as Record<string, unknown>).name : object.brand;
        if (typeof brand === "string" && brand.trim()) facts.brand = brand.trim().slice(0, 160);
        const offers = Array.isArray(object.offers) ? object.offers[0] : object.offers;
        if (offers && typeof offers === "object") {
          const record = offers as Record<string, unknown>;
          const price = record.price ?? record.lowPrice;
          if (typeof price === "string" || typeof price === "number") facts.priceAmount = String(price).slice(0, 32);
          if (typeof record.priceCurrency === "string") facts.priceCurrency = record.priceCurrency.slice(0, 8);
        }
        const image = Array.isArray(object.image) ? object.image[0] : object.image;
        const imageUrl = typeof image === "string" ? image : image && typeof image === "object" ? (image as Record<string, unknown>).url : null;
        if (!facts.imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("https://")) facts.imageUrl = imageUrl.slice(0, 2048);
      }
    } catch {
      // A malformed JSON-LD block is simply skipped.
    }
  }

  const text = decodeEntities(htmlToText(html));
  facts.textSnippet = text.slice(0, 1500) || undefined;
  return facts;
}
