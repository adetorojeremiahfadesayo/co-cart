import mealsData from "./products.json";
import gadgetsData from "./gadgets.json";
import clothingData from "./clothing.json";
import type {
  CatalogAdapter,
  DataSourceStatus,
  DecisionBrief,
  DecisionDomain,
  DomainConfig,
  Product,
} from "../types";

const demoStatus: DataSourceStatus = {
  mode: "demo",
  label: "Demo data",
  detail:
    "Seeded examples for repeatable comparisons. Prices, availability, merchants, and delivery estimates are illustrative—not live offers.",
};

const mealMerchants = ["Demo Fresh Market", "Demo Pantry Co.", "Demo Meal Hall"];

const meals: Product[] = (mealsData as Omit<Product, "domain" | "merchant" | "demoOnly">[]).map(
  (product, index) => ({
    ...product,
    domain: "meals",
    merchant: mealMerchants[index % mealMerchants.length],
    demoOnly: true,
    deliveryDays: 2 + (index % 3),
  }),
);

const normalize = (domain: DecisionDomain, rows: Omit<Product, "domain" | "demoOnly">[]) =>
  rows.map((row) => ({ ...row, domain, demoOnly: true })) as Product[];

export const catalogs: Record<DecisionDomain, Product[]> = {
  meals,
  gadgets: normalize("gadgets", gadgetsData as Omit<Product, "domain" | "demoOnly">[]),
  clothing: normalize("clothing", clothingData as Omit<Product, "domain" | "demoOnly">[]),
};

export const demoCatalogAdapter: CatalogAdapter = {
  id: "seeded-demo",
  status: demoStatus,
  async load(domain) {
    return catalogs[domain];
  },
};

export const SHOPIFY_GLOBAL_CATALOG_STATUS: DataSourceStatus = {
  mode: "unavailable",
  label: "Live search not started",
  detail:
    "The active workflow waits for a successful OpenAI → Shopify Global Catalog search. It never activates the demo adapter automatically.",
};

export const DOMAIN_CONFIG: Record<DecisionDomain, DomainConfig> = {
  meals: {
    id: "meals",
    label: "Meals & Nutrition",
    shortLabel: "Meals",
    symbol: "M",
    outcome: "Balance calories, allergens, time, and total listed price without reading every label.",
    demoRequest:
      "Find three dinners under 400 calories, peanut-free, ready in 30 minutes, below $60.",
    categories: ["all", "dinner", "lunch", "breakfast", "snack", "dessert"],
    preset: {
      request: "Find three dinners under 400 calories, peanut-free, ready in 30 minutes, below $60.",
      required: ["Dinner", "400 calories or less", "Ready in 30 minutes"],
      preferred: ["High protein", "Fresh or light"],
      budget: 60,
      dealBreakers: ["Contains peanuts"],
      targetCount: 3,
    },
  },
  gadgets: {
    id: "gadgets",
    label: "Gadgets",
    shortLabel: "Gadgets",
    symbol: "G",
    outcome: "Compare the specs that matter and keep every price claim tied to a current merchant listing.",
    demoRequest:
      "Find noise-cancelling headphones under $200 with long battery life and the best available price.",
    categories: ["all", "headphones"],
    preset: {
      request:
        "Find noise-cancelling headphones under $200 with long battery life and the best available price.",
      required: ["Active noise cancelling", "Wireless headphones"],
      preferred: ["40+ hours battery", "Under 270 g", "Multipoint pairing"],
      budget: 200,
      dealBreakers: ["No active noise cancelling"],
      targetCount: 1,
    },
  },
  clothing: {
    id: "clothing",
    label: "Clothing & Style",
    shortLabel: "Clothing",
    symbol: "C",
    outcome: "Compare complete looks by fit, fabric, formality, delivery, and listed total.",
    demoRequest:
      "Build a breathable outfit for an outdoor wedding, size medium, below $150.",
    categories: ["all", "outfit"],
    preset: {
      request: "Build a breathable outfit for an outdoor wedding, size medium, below $150.",
      required: ["Size M available", "High breathability", "Suitable for an outdoor wedding"],
      preferred: ["Formal finish", "Natural or low-impact fabric"],
      budget: 150,
      dealBreakers: ["Size M unavailable"],
      deliveryDeadline: "Within 5 days",
      targetCount: 1,
    },
  },
};

export const blankBrief = (): DecisionBrief => ({
  request: "",
  required: [],
  preferred: [],
  dealBreakers: [],
  targetCount: 1,
});
