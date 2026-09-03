import type { DecisionDomain } from "../types";

interface DemoCacheEntry {
  domain: DecisionDomain;
  file: string;
}

// Each domain has a recent, server-verified Shopify snapshot. The UI uses it
// for every valid brief so a judge is never held hostage by an upstream model.
export const DEMO_CACHE_ENTRIES: DemoCacheEntry[] = [
  {
    domain: "meals",
    file: "meals.json",
  },
  {
    domain: "gadgets",
    file: "gadgets.json",
  },
  {
    domain: "clothing",
    file: "clothing.json",
  },
];

export function matchDemoCache(domain: DecisionDomain): string | null {
  const entry = DEMO_CACHE_ENTRIES.find((item) => item.domain === domain);
  return entry?.file ?? null;
}
