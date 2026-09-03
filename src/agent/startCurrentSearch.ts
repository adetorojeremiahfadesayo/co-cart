import { DOMAIN_CONFIG } from "../data/catalog";
import { requiredQuestionIds } from "../decision/questions";
import { useStore } from "../store/useStore";
import { runCoordinatedSearch } from "./searchCoordinator";

export async function startCurrentLiveSearch() {
  const state = useStore.getState();
  if (!state.domain) throw new Error("Choose a shopping category before starting a search.");
  const missing = requiredQuestionIds(state.domain).filter((id) => !state.answers[id]?.length);
  if (missing.length) throw new Error(`Answer all decisions before searching. ${missing.length} decision(s) remain.`);

  const domain = state.domain;
  const answers = structuredClone(state.answers);
  const searchId = state.beginLiveSearch();
  if (!searchId) throw new Error("A live search is already running.");
  state.log("user", `Started live ${DOMAIN_CONFIG[domain].shortLabel.toLowerCase()} search`);

  try {
    const result = await runCoordinatedSearch(domain, answers, {
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
