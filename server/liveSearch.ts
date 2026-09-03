import { validateDecisionAnswers } from "../src/decision/questions.ts";
import { countryFromAddress } from "../src/decision/country.ts";
import { executeShopifyAgentTool, OPENAI_SHOPIFY_FUNCTION_TOOLS, UCP_AGENT_PROFILE } from "./shopifyMcp.ts";
import { fetchWithTransientRetry } from "./fetchWithRetry.ts";

type DecisionDomain = "meals" | "gadgets" | "clothing";
type Answers = Record<string, string[]>;
type SearchStatus = "active" | "done" | "error";
type JsonObject = Record<string, unknown>;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_REQUEST_BYTES = 16_384;
const SEARCH_TIMEOUT_MS = 90_000;
const RATE_WINDOW_MS = 10 * 60_000;
const DEFAULT_RATE_LIMIT = 5;
const DEFAULT_MAX_CONCURRENT = 8;
const RECOMMENDATION_CLASSES = ["Top-rated choice", "Best value", "Budget hidden gem", "Trusted standard", "Best overall match"] as const;

const productSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceId: { type: "string" },
    recommendationClass: { type: "string", enum: RECOMMENDATION_CLASSES },
    recommendation: { type: "string" },
    tradeoffs: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["sourceId", "recommendationClass", "recommendation", "tradeoffs", "tags"],
} as const;

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    products: { type: "array", minItems: 1, maxItems: 6, items: productSchema },
  },
  required: ["summary", "products"],
} as const;

interface VerifiedProduct {
  sourceId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  merchant: string;
  imageUrl?: string;
  productUrl?: string;
  checkoutUrl?: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
let activeSearches = 0;

const jsonLine = (value: unknown) => `${JSON.stringify(value)}\n`;
const asObject = (value: unknown): JsonObject | null => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;

function numberSetting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function clientIdentity(request: Request) {
  const session = request.headers.get("x-cocart-session")?.trim();
  const safeSession = session && /^[a-zA-Z0-9_-]{8,64}$/.test(session) ? session : "anonymous";
  const forwarded = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return { rateKeys: [`ip:${forwarded}`, `session:${safeSession}`], safetyIdentifier: `cocart_${safeSession}`.slice(0, 64) };
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function takeRateLimit(key: string) {
  const now = Date.now();
  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucketValue] of rateBuckets) {
      if (bucketValue.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }
  const limit = numberSetting("COCART_SEARCH_RATE_LIMIT", DEFAULT_RATE_LIMIT);
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function takeRateLimits(keys: string[]) {
  const outcomes = keys.map(takeRateLimit);
  const blocked = outcomes.find((outcome) => !outcome.allowed);
  return blocked ?? { allowed: true, retryAfterSeconds: 0 };
}

function safeUrl(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function validCurrency(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value.toUpperCase())) return null;
  const currency = value.toUpperCase();
  try {
    new Intl.NumberFormat("en", { style: "currency", currency }).format(0);
    return currency;
  } catch {
    return null;
  }
}

function minorUnitDivisor(currency: string) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return 10 ** digits;
}

function plainDescription(value: unknown) {
  if (typeof value === "string") return value;
  const object = asObject(value);
  return typeof object?.plain === "string" ? object.plain : "";
}

function parseEmbeddedJson(value: unknown): unknown[] {
  if (typeof value !== "string") return [value];
  try {
    return [JSON.parse(value)];
  } catch {
    return [];
  }
}

function collectProductArrays(value: unknown, depth = 0): unknown[][] {
  if (depth > 8) return [];
  return parseEmbeddedJson(value).flatMap((parsed) => {
    if (Array.isArray(parsed)) return parsed.flatMap((item) => collectProductArrays(item, depth + 1));
    const object = asObject(parsed);
    if (!object) return [];
    const own = Array.isArray(object.products) ? [object.products] : [];
    return [...own, ...Object.entries(object).filter(([key]) => key !== "products").flatMap(([, child]) => collectProductArrays(child, depth + 1))];
  });
}

function buildProvenance(items: JsonObject[]) {
  const verified = new Map<string, VerifiedProduct>();
  for (const item of items) {
    for (const products of collectProductArrays(item.output)) {
      for (const rawProduct of products) {
        const product = asObject(rawProduct);
        if (!product || typeof product.title !== "string" || !Array.isArray(product.variants)) continue;
        const productDescription = plainDescription(product.description);
        const productMedia = Array.isArray(product.media) ? product.media : [];
        for (const rawVariant of product.variants) {
          const variant = asObject(rawVariant);
          const price = asObject(variant?.price);
          const seller = asObject(variant?.seller);
          const availability = asObject(variant?.availability);
          const sourceId = typeof variant?.id === "string" ? variant.id : null;
          const amount = Number(price?.amount);
          const currency = validCurrency(price?.currency);
          if (!sourceId || !Number.isInteger(amount) || amount < 0 || !currency || typeof seller?.name !== "string") continue;
          if (availability?.available === false) continue;
          const variantMedia = Array.isArray(variant?.media) ? variant.media : [];
          const image = asObject(variantMedia[0]) ?? asObject(productMedia[0]);
          verified.set(sourceId, {
            sourceId,
            title: product.title.slice(0, 180),
            description: (plainDescription(variant?.description) || productDescription || "Current Shopify catalog listing").slice(0, 500),
            price: amount / minorUnitDivisor(currency),
            currency,
            merchant: seller.name.slice(0, 160),
            imageUrl: safeUrl(image?.url),
            productUrl: safeUrl(variant?.url),
            checkoutUrl: safeUrl(variant?.checkout_url),
          });
        }
      }
    }
  }
  return verified;
}

function normalizeJsonText(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function parseOutput(text: string, domain: DecisionDomain, provenance: Map<string, VerifiedProduct>) {
  const parsed = JSON.parse(normalizeJsonText(text)) as { summary?: unknown; products?: unknown };
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.products)) throw new Error("OpenAI returned an invalid result shape.");
  const seen = new Set<string>();
  const products = parsed.products.map((raw, index) => {
    const item = asObject(raw);
    const sourceId = typeof item?.sourceId === "string" ? item.sourceId : "";
    const source = provenance.get(sourceId);
    if (!source || seen.has(sourceId)) throw new Error(`Result ${index + 1} could not be verified against completed Shopify output.`);
    seen.add(sourceId);
    return {
      id: `shopify-${sourceId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(-80)}-${index}`,
      sourceId,
      domain,
      name: source.title,
      category: domain,
      price: source.price,
      currency: source.currency,
      merchant: source.merchant,
      description: source.description,
      emoji: domain === "meals" ? "M" : domain === "gadgets" ? "G" : "C",
      tags: Array.isArray(item?.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8) : [],
      demoOnly: false,
      imageUrl: source.imageUrl,
      productUrl: source.productUrl,
      checkoutUrl: source.checkoutUrl,
      recommendationClass: RECOMMENDATION_CLASSES.includes(item?.recommendationClass as typeof RECOMMENDATION_CLASSES[number])
        ? item?.recommendationClass as typeof RECOMMENDATION_CLASSES[number]
        : "Best overall match",
      recommendation: typeof item?.recommendation === "string" ? item.recommendation.slice(0, 500) : "Matched to your decision brief",
      tradeoffs: Array.isArray(item?.tradeoffs) ? item.tradeoffs.filter((value): value is string => typeof value === "string").slice(0, 4) : [],
    };
  });
  if (!products.length) throw new Error("The live Shopify search returned no verified products.");
  return { summary: parsed.summary.slice(0, 800), products };
}

function extractResponseText(response: JsonObject) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.flatMap((item) => {
    const itemObject = asObject(item);
    const content = Array.isArray(itemObject?.content) ? itemObject.content : [];
    return content.map(asObject).filter((part): part is JsonObject => part?.type === "output_text" && typeof part.text === "string").map((part) => part.text as string);
  }).join("");
}

export function resetLiveSearchGuardsForTests() {
  rateBuckets.clear();
  activeSearches = 0;
}

export async function handleLiveSearch(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isSameOrigin(request)) return new Response("Cross-origin live search is not allowed", { status: 403 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return new Response("Request too large", { status: 413 });
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return new Response("Request too large", { status: 413 });

  let payload: JsonObject;
  try {
    payload = JSON.parse(rawBody) as JsonObject;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const domain = payload.domain;
  if (domain !== "meals" && domain !== "gadgets" && domain !== "clothing") return new Response("Invalid live-search request", { status: 400 });
  const answers = validateDecisionAnswers(domain, payload.answers) as Answers | null;
  if (!answers) return new Response("Invalid live-search request", { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("Live agent unavailable: OPENAI_API_KEY is not configured on the server. No demo fallback was used.", { status: 503 });

  const identity = clientIdentity(request);
  const rate = takeRateLimits(identity.rateKeys);
  if (!rate.allowed) return new Response("Live-search rate limit reached. No demo fallback was used.", { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
  if (activeSearches >= numberSetting("COCART_MAX_CONCURRENT_SEARCHES", DEFAULT_MAX_CONCURRENT)) return new Response("Live agent is at capacity. Try again shortly. No demo fallback was used.", { status: 503, headers: { "retry-after": "10" } });
  activeSearches += 1;

  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  const deliveryAddress = answers.delivery_address?.[0];
  const derivedCountry = deliveryAddress ? countryFromAddress(deliveryAddress) : null;
  const brief = Object.entries(answers)
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("\n") + (derivedCountry ? `\nderived_country: ${derivedCountry}` : "");
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const abortFromRequest = () => abortController.abort(request.signal.reason);
  request.signal.addEventListener("abort", abortFromRequest, { once: true });
  const timeout = setTimeout(() => abortController.abort(new Error("Live search timed out.")), SEARCH_TIMEOUT_MS);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(jsonLine(event)));
      let lastStatus = "";
      const updateStatus = (label: string, detail: string, status: SearchStatus = "active") => {
        const key = `${status}:${label}`;
        if (key !== lastStatus) emit({ type: "status", label, detail, status });
        lastStatus = key;
      };
      let outputText = "";
      const successfulShopifyItems: JsonObject[] = [];
      let inputItems: unknown[] = [{ role: "user", content: [{ type: "input_text", text: `Find live Shopify catalog products for the ${domain} domain. Buyer answers:\n${brief}` }] }];
      let toolCallCount = 0;
      let firstRound = true;

      try {
        updateStatus("Connecting to OpenAI", `Running ${model} with Shopify Global Catalog`);
        while (true) {
          let response: JsonObject | null = null;
          let attemptFailure = "";
          for (let attempt = 0; attempt < 2 && !response; attempt += 1) {
            const openaiResponse = await fetchWithTransientRetry(OPENAI_RESPONSES_URL, {
              method: "POST",
              signal: abortController.signal,
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                store: false,
                include: ["reasoning.encrypted_content"],
                parallel_tool_calls: false,
                max_output_tokens: attempt === 0 ? 8000 : 12_000,
                safety_identifier: identity.safetyIdentifier,
                instructions: [
                  "You are Co-Cart's live shopping agent. All product discovery must use the supplied shopify_* functions, which execute Shopify Global Catalog MCP on the server. Do not use memory or invent products.",
                  `The server injects the required UCP agent profile ${UCP_AGENT_PROFILE} into every Shopify MCP call.`,
                  "The required first function is shopify_search_catalog. You may use shopify_get_product or shopify_lookup_catalog to verify finalists.",
                  "Only select currently available variants present in successful Shopify function outputs.",
                  "For every finalist, return sourceId as the exact gid://shopify/ProductVariant/... ID from a Shopify function output.",
                  "Do not repeat merchant, price, URL, image, or title facts in the structured selection; the server reconstructs those from Shopify output.",
                  "Weigh the buyer's decision_style (crowd favourite, best value, hidden gem, industry standard) and store_preference (no preference, big-name stores, smaller independent stores) when choosing finalists and assigning each classification.",
                  "The buyer's delivery address is free text; the server adds a derived_country line (NG, US, GB, or CA). Always pass that derived_country value as address_country to every shopify_* function call.",
                  `Classify every finalist as exactly one of: ${RECOMMENDATION_CLASSES.join(", ")}.`,
                  "Use Top-rated choice only when the Shopify output contains explicit rating or review evidence. Never invent ratings, review counts, merchant quality, or brand reputation.",
                  "Treat each classification as a concise editorial role supported by the live evidence and the buyer's requested recommendation style.",
                  "Return between one and six finalists. Make the shortlist concise and explain why each item matches plus honest tradeoffs.",
                ].join("\n"),
                input: inputItems,
                tools: OPENAI_SHOPIFY_FUNCTION_TOOLS,
                tool_choice: firstRound ? { type: "function", name: "shopify_search_catalog" } : "auto",
                text: { format: { type: "json_schema", name: "live_shopify_shortlist", strict: true, schema: outputSchema } },
              }),
            });

            const rawOpenAi = await openaiResponse.text();
            if (!openaiResponse.ok) {
              let detail = "The OpenAI agent rejected the request.";
              try {
                const payload = asObject(JSON.parse(rawOpenAi));
                const error = asObject(payload?.error);
                if (typeof error?.message === "string") detail = error.message;
              } catch {
                // Keep the stable public error when OpenAI does not return JSON.
              }
              attemptFailure = `OpenAI live agent request failed (${openaiResponse.status}): ${detail}`;
              if (attempt === 0 && (openaiResponse.status === 429 || openaiResponse.status >= 500)) {
                updateStatus("Retrying the OpenAI agent", `First attempt failed (HTTP ${openaiResponse.status}); trying once more`);
                continue;
              }
              throw new Error(attemptFailure);
            }

            let parsed: JsonObject;
            try {
              parsed = JSON.parse(rawOpenAi) as JsonObject;
            } catch {
              throw new Error("OpenAI returned invalid JSON for the live shopping agent.");
            }
            const responseError = asObject(parsed.error);
            if (responseError) throw new Error(typeof responseError.message === "string" ? responseError.message : "The OpenAI live shopping agent failed.");
            const openAiStatus = typeof parsed.status === "string" ? parsed.status : "unknown";
            if (openAiStatus !== "completed") {
              attemptFailure = `The OpenAI live shopping agent did not complete its turn (status: ${openAiStatus}).`;
              if (attempt === 0 && openAiStatus === "incomplete") {
                updateStatus("Retrying the OpenAI agent", "The first attempt stopped early; trying once more with more room");
                continue;
              }
              throw new Error(attemptFailure);
            }
            response = parsed;
          }
          if (!response) throw new Error(attemptFailure || "The OpenAI live shopping agent failed.");
          const output = Array.isArray(response.output) ? response.output : [];
          const functionCalls = output.map(asObject).filter((item): item is JsonObject => item?.type === "function_call");

          if (!functionCalls.length) {
            outputText = extractResponseText(response);
            break;
          }

          if (toolCallCount + functionCalls.length > 6) throw new Error("The shopping agent exceeded the six-call Shopify safety limit.");
          inputItems = [...inputItems, ...output];
          for (const call of functionCalls) {
            if (typeof call.call_id !== "string" || typeof call.name !== "string" || typeof call.arguments !== "string") throw new Error("OpenAI returned an invalid Shopify function call.");
            let callArguments: unknown;
            try {
              callArguments = JSON.parse(call.arguments);
            } catch {
              throw new Error("OpenAI returned malformed Shopify function arguments.");
            }
            updateStatus(call.name === "shopify_search_catalog" ? "Searching Shopify" : "Verifying Shopify products", "Calling Shopify Global Catalog MCP from Co-Cart's server");
            const result = await executeShopifyAgentTool(call.name, callArguments, abortController.signal);
            toolCallCount += 1;
            successfulShopifyItems.push({
              type: "mcp_call",
              id: call.call_id,
              name: result.shopifyToolName,
              arguments: JSON.stringify(result.argumentsWithProfile),
              output: result.output,
            });
            inputItems.push({ type: "function_call_output", call_id: call.call_id, output: result.output });
            const candidateCount = result.shopifyToolName === "search_catalog"
              ? collectProductArrays(result.output).reduce((total, products) => total + products.length, 0)
              : 0;
            updateStatus(
              "Shopify call completed",
              candidateCount ? `Found ${candidateCount} live listing${candidateCount === 1 ? "" : "s"} matching the brief` : `Received current ${result.shopifyToolName} data`,
              "done",
            );
          }
          firstRound = false;
          updateStatus("OpenAI agent comparing options", "Reviewing verified Shopify records and deciding whether more evidence is needed");
        }

        if (!successfulShopifyItems.some((item) => item.name === "search_catalog")) throw new Error("No successful Shopify search_catalog call was completed, so the response was rejected. No fallback was used.");
        const provenance = buildProvenance(successfulShopifyItems);
        if (!provenance.size) throw new Error("Shopify returned no verifiable available variants. No fallback was used.");
        updateStatus("Comparing verified options", "Building the shortlist from exact Shopify variant records");
        if (!outputText.trim()) throw new Error("OpenAI returned no structured selection after the Shopify MCP call.");
        emit({ type: "result", ...parseOutput(outputText, domain, provenance) });
      } catch (error) {
        const message = abortController.signal.aborted ? "Live search was cancelled or timed out. No demo fallback was used." : error instanceof Error ? error.message : String(error);
        emit({ type: "error", message });
      } finally {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abortFromRequest);
        activeSearches = Math.max(0, activeSearches - 1);
        controller.close();
      }
    },
    cancel() {
      abortController.abort(new Error("Client cancelled live search."));
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
