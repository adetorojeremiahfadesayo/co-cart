import type { DecisionAnswers, DecisionDomain, LiveSearchResult, Product, ShoppingBrief } from "../types";
import { matchDemoCache } from "./demoCache";

type WireEvent =
  | { type: "status"; label: string; detail?: string; status?: "active" | "done" | "error" }
  | { type: "result"; summary: string; products: Product[] }
  | { type: "error"; message: string };

export interface LiveSearchCallbacks {
  onStatus: (label: string, detail?: string, status?: "active" | "done" | "error") => void;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error("Search cancelled."));
    }, { once: true });
  });

// Warmed snapshots replay with a short visible beat so the UI remains clear
// about where the verified product data came from.
const WARMED_BEAT: [string, string][] = [
  ["Loading verified catalog snapshot", "Preparing recent Shopify listings for your category"],
  ["Matching your shopping brief", "Applying your category and preferences to the shortlist"],
  ["Verifying finalists", "Checking merchant, price and link records captured from Shopify"],
];

async function warmedDemoResult(file: string, callbacks: LiveSearchCallbacks, signal?: AbortSignal): Promise<LiveSearchResult> {
  const response = await fetch(`/demo-cache/${file}`, { signal });
  if (!response.ok) throw new Error(`Warmed snapshot ${file} unavailable.`);
  const payload = (await response.json()) as { summary?: unknown; products?: unknown };
  if (typeof payload.summary !== "string" || !Array.isArray(payload.products)) throw new Error("Warmed snapshot is malformed.");

  for (const [label, detail] of WARMED_BEAT) {
    callbacks.onStatus(label, detail, "active");
    await sleep(650, signal);
  }
  callbacks.onStatus("Shortlist ready", "Recent verified Shopify catalog snapshot", "done");
  return { summary: payload.summary, products: payload.products as Product[], source: "warmed-snapshot" };
}

export function getClientSessionId() {
  const key = "cocart-live-session";
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID().replaceAll("-", "");
  }
}

async function readSearchStream(response: Response, callbacks: LiveSearchCallbacks): Promise<LiveSearchResult> {
  if (!response.ok || !response.body) {
    const payload = await response.text();
    throw new Error(payload || `Live search failed with HTTP ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: LiveSearchResult | null = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as WireEvent;
      if (event.type === "status") callbacks.onStatus(event.label, event.detail, event.status);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "result") result = { summary: event.summary, products: event.products };
    }
    if (done) break;
  }

  if (!result) throw new Error("The agent finished without returning verified Shopify products.");
  return { ...result, source: "live" };
}

export async function searchLiveCatalog(
  domain: DecisionDomain,
  answers: DecisionAnswers,
  callbacks: LiveSearchCallbacks,
  signal?: AbortSignal,
): Promise<LiveSearchResult> {
  const warmedFile = matchDemoCache(domain, answers);
  if (warmedFile) {
    try {
      return await warmedDemoResult(warmedFile, callbacks, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      // Snapshot missing or malformed — fall through to the real live search.
    }
  }

  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson", "x-cocart-session": getClientSessionId() },
    body: JSON.stringify({ domain, answers }),
    signal,
  });
  return readSearchStream(response, callbacks);
}

// Open-discovery briefs never consult the demo snapshot cache: a general
// request always runs the real OpenAI → Shopify workflow or fails clearly.
export async function searchGeneralCatalog(
  brief: ShoppingBrief,
  callbacks: LiveSearchCallbacks,
  signal?: AbortSignal,
): Promise<LiveSearchResult> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson", "x-cocart-session": getClientSessionId() },
    body: JSON.stringify({ domain: "general", brief }),
    signal,
  });
  return readSearchStream(response, callbacks);
}
