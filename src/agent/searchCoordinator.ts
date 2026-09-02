import { searchLiveCatalog, type LiveSearchCallbacks } from "./liveSearch";
import type { DecisionAnswers, DecisionDomain } from "../types";

let activeController: AbortController | null = null;

export function cancelActiveSearch() {
  activeController?.abort();
  activeController = null;
}

export async function runCoordinatedSearch(
  domain: DecisionDomain,
  answers: DecisionAnswers,
  callbacks: LiveSearchCallbacks,
) {
  if (activeController) throw new Error("A live search is already running.");
  const controller = new AbortController();
  activeController = controller;
  try {
    return await searchLiveCatalog(domain, answers, callbacks, controller.signal);
  } finally {
    if (activeController === controller) activeController = null;
  }
}
