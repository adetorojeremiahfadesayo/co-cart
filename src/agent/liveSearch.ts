import type { DecisionAnswers, DecisionDomain, LiveSearchResult, Product } from "../types";

type WireEvent =
  | { type: "status"; label: string; detail?: string; status?: "active" | "done" | "error" }
  | { type: "result"; summary: string; products: Product[] }
  | { type: "error"; message: string };

export interface LiveSearchCallbacks {
  onStatus: (label: string, detail?: string, status?: "active" | "done" | "error") => void;
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

export async function searchLiveCatalog(
  domain: DecisionDomain,
  answers: DecisionAnswers,
  callbacks: LiveSearchCallbacks,
  signal?: AbortSignal,
): Promise<LiveSearchResult> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson", "x-cocart-session": getClientSessionId() },
    body: JSON.stringify({ domain, answers }),
    signal,
  });

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
  return result;
}
