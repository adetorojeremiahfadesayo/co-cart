import { searchGeneralCatalog, searchLiveCatalog, type LiveSearchCallbacks } from "./liveSearch";
import type { DecisionAnswers, DecisionDomain, ShoppingBrief } from "../types";

let activeController: AbortController | null = null;

export function cancelActiveSearch() {
  activeController?.abort();
  activeController = null;
}

async function coordinate<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (activeController) throw new Error("A live search is already running.");
  const controller = new AbortController();
  activeController = controller;
  try {
    return await run(controller.signal);
  } finally {
    if (activeController === controller) activeController = null;
  }
}

export async function runCoordinatedSearch(
  domain: DecisionDomain,
  answers: DecisionAnswers,
  callbacks: LiveSearchCallbacks,
) {
  return coordinate((signal) => searchLiveCatalog(domain, answers, callbacks, signal));
}

export async function runCoordinatedGeneralSearch(
  brief: ShoppingBrief,
  callbacks: LiveSearchCallbacks,
) {
  return coordinate((signal) => searchGeneralCatalog(brief, callbacks, signal));
}
