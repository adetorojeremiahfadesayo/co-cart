import { DEMO_DELIVERY_ADDRESS } from "../decision/country";
import type { DecisionAnswers, DecisionDomain } from "../types";

interface DemoCacheEntry {
  domain: DecisionDomain;
  answers: DecisionAnswers;
  file: string;
}

// The exact answer paths that have warmed snapshots in public/demo-cache/.
// Any deviation falls through to the real live search.
export const DEMO_CACHE_ENTRIES: DemoCacheEntry[] = [
  {
    domain: "meals",
    file: "meals.json",
    answers: {
      meal_type: ["quick dinner"],
      decision_style: ["crowd favourite"],
      store_preference: ["no preference"],
      food_priority: ["high protein"],
      budget: ["25"],
      delivery_address: [DEMO_DELIVERY_ADDRESS],
    },
  },
  {
    domain: "gadgets",
    file: "gadgets.json",
    answers: {
      gadget_type: ["wireless headphones"],
      decision_style: ["crowd favourite"],
      store_preference: ["no preference"],
      gadget_priority: ["long battery life"],
      budget: ["50"],
      delivery_address: [DEMO_DELIVERY_ADDRESS],
    },
  },
  {
    domain: "clothing",
    file: "clothing.json",
    answers: {
      clothing_type: ["complete outfit"],
      decision_style: ["crowd favourite"],
      store_preference: ["no preference"],
      style_priority: ["minimal"],
      budget: ["75"],
      delivery_address: [DEMO_DELIVERY_ADDRESS],
    },
  },
];

const signature = (answers: DecisionAnswers) =>
  Object.keys(answers)
    .sort()
    .map((key) => `${key}=${[...answers[key]].sort().join(",")}`)
    .join("&");

export function matchDemoCache(domain: DecisionDomain, answers: DecisionAnswers): string | null {
  const target = signature(answers);
  const entry = DEMO_CACHE_ENTRIES.find((item) => item.domain === domain && signature(item.answers) === target);
  return entry?.file ?? null;
}
