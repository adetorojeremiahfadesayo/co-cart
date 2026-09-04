import { REQUEST_MAX_LENGTH, REQUEST_MIN_LENGTH, validateDiscoveryText } from "../decision/shoppingBrief";
import { useStore } from "../store/useStore";
import type { InterpretationPayload } from "./discovery";
import { interpretImageRequest, interpretTextRequest, interpretUrlRequest } from "./discovery";
import { runCoordinatedGeneralSearch } from "./searchCoordinator";
import type { LiveSearchResult } from "../types";

let activeInterpretationController: AbortController | null = null;

export function cancelActiveInterpretation() {
  activeInterpretationController?.abort(new DOMException("Interpretation cancelled.", "AbortError"));
  activeInterpretationController = null;
}

async function runInterpretation(
  mode: "text" | "image" | "url",
  request: { text?: string; url?: string },
  interpret: (signal: AbortSignal) => Promise<InterpretationPayload>,
): Promise<InterpretationPayload> {
  cancelActiveInterpretation();
  const controller = new AbortController();
  activeInterpretationController = controller;
  const operationId = useStore.getState().startGeneralDiscovery(mode, request);
  try {
    const payload = await interpret(controller.signal);
    if (!useStore.getState().completeInterpretation(operationId, payload)) {
      throw new Error("The interpretation was superseded by a newer request.");
    }
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useStore.getState().failInterpretation(operationId, message);
    throw error;
  } finally {
    if (activeInterpretationController === controller) activeInterpretationController = null;
  }
}

export function startTextDiscovery(rawText: string) {
  const text = validateDiscoveryText(rawText);
  if (!text) throw new Error(`Describe the product in ${REQUEST_MIN_LENGTH}–${REQUEST_MAX_LENGTH} characters.`);
  return runInterpretation("text", { text }, (signal) => interpretTextRequest(text, signal));
}

export function startUrlDiscovery(rawUrl: string) {
  const value = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Paste one complete product link, for example https://store.com/product.");
  }
  if (parsed.protocol !== "https:") throw new Error("Only https:// product links can be inspected safely.");
  if (parsed.username || parsed.password) throw new Error("Product links containing usernames or passwords are not accepted.");
  if (parsed.port && parsed.port !== "443") throw new Error("Product links must use the standard secure HTTPS port.");
  return runInterpretation("url", { url: parsed.toString() }, (signal) => interpretUrlRequest(parsed.toString(), signal));
}

export function startImageDiscovery(imageDataUrl: string) {
  return runInterpretation("image", {}, (signal) => interpretImageRequest(imageDataUrl, signal));
}

export async function startGeneralLiveSearch(): Promise<LiveSearchResult> {
  const state = useStore.getState();
  if (state.domain !== "general" || !state.shoppingBrief) throw new Error("Describe what you are looking for before starting a search.");
  const confirmedStage = state.stage === "brief-review" || (state.stage === "error" && state.briefConfirmed);
  if (!confirmedStage || !state.briefConfirmed) throw new Error("Review and confirm the shopping brief before searching.");
  const brief = structuredClone(state.shoppingBrief);
  const searchId = state.beginLiveSearch();
  if (!searchId) throw new Error("A live search is already running.");
  state.log("user", `Started live open search for "${brief.productType}"`);

  try {
    const result = await runCoordinatedGeneralSearch(brief, {
      onStatus: (label, detail, status) => useStore.getState().addSearchEvent(searchId, label, detail, status),
    });
    if (!useStore.getState().completeLiveSearch(searchId, result.products, result.summary, result.source)) {
      throw new Error("The search was superseded before results arrived.");
    }
    useStore.getState().log("agent", `Returned ${result.products.length} verified live Shopify result(s)`, "start-live-search", "success");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (useStore.getState().failLiveSearch(searchId, message)) {
      useStore.getState().log("agent", `Live search stopped · ${message}`, "start-live-search", "error");
    }
    throw error;
  }
}
