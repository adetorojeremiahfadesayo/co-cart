import { normalizeClarifyingQuestions, validateDiscoveryReference, validateShoppingBrief } from "../decision/shoppingBrief";
import type { ClarifyingQuestion, DiscoveryReference, ShoppingBrief } from "../types";
import { getClientSessionId } from "./liveSearch";

export interface InterpretationPayload {
  reference: DiscoveryReference;
  brief: ShoppingBrief;
  questions: ClarifyingQuestion[];
}

async function postDiscovery(body: Record<string, unknown>, signal?: AbortSignal): Promise<InterpretationPayload> {
  const response = await fetch("/api/discovery", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-cocart-session": getClientSessionId() },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null) as { error?: unknown; reference?: unknown; brief?: unknown; questions?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `Request interpretation failed with HTTP ${response.status}.`);
  }
  const reference = validateDiscoveryReference(payload?.reference);
  const brief = validateShoppingBrief(payload?.brief);
  if (!reference || !brief) throw new Error("The interpretation response was incomplete. Please try again.");
  return { reference, brief: { ...brief, reference }, questions: normalizeClarifyingQuestions(payload?.questions) };
}

export function interpretTextRequest(text: string, signal?: AbortSignal) {
  return postDiscovery({ mode: "text", text }, signal);
}

export function interpretUrlRequest(url: string, signal?: AbortSignal) {
  return postDiscovery({ mode: "url", url }, signal);
}

// The image is always a metadata-stripped, canvas re-encoded PNG data URL.
export function interpretImageRequest(imageDataUrl: string, signal?: AbortSignal) {
  const comma = imageDataUrl.indexOf(",");
  const header = imageDataUrl.slice(0, comma);
  const mimeMatch = /^data:(image\/(?:jpeg|png|webp));base64$/.exec(header);
  if (!mimeMatch) return Promise.reject(new Error("Only JPEG, PNG, or WebP images can be interpreted."));
  return postDiscovery({ mode: "image", imageBase64: imageDataUrl.slice(comma + 1), mimeType: mimeMatch[1] }, signal);
}
