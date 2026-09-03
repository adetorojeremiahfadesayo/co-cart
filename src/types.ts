export type DecisionDomain = "meals" | "gadgets" | "clothing";

export type AppStage = "decisions" | "searching" | "results" | "error";

export type DecisionAnswers = Record<string, string[]>;

export interface SearchEvent {
  id: number;
  label: string;
  detail?: string;
  status: "active" | "done" | "error";
}

export type DataSourceMode = "demo" | "live" | "unavailable";

export interface DataSourceStatus {
  mode: DataSourceMode;
  label: string;
  detail: string;
}

export interface Product {
  id: string;
  sourceId?: string;
  domain: DecisionDomain;
  name: string;
  category: string;
  price: number;
  merchant: string;
  description: string;
  emoji: string;
  tags: string[];
  demoOnly: boolean;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  checkoutUrl?: string;
  recommendationClass?: "Top-rated choice" | "Best value" | "Budget hidden gem" | "Trusted standard" | "Best overall match";
  recommendation?: string;
  tradeoffs?: string[];
  deliveryDays?: number;
  kcalPerServing?: number;
  servings?: number;
  proteinG?: number;
  allergens?: string[];
  diets?: string[];
  prepMinutes?: number;
  brand?: string;
  batteryHours?: number;
  noiseCancelling?: boolean;
  wireless?: boolean;
  weightG?: number;
  codecSupport?: string[];
  sizes?: string[];
  materials?: string[];
  breathability?: "low" | "medium" | "high";
  formality?: "casual" | "smart" | "formal";
  pieces?: string[];
}

export interface LiveSearchResult {
  summary: string;
  products: Product[];
}

export interface DecisionBrief {
  request: string;
  required: string[];
  preferred: string[];
  budget?: number;
  dealBreakers: string[];
  deliveryDeadline?: string;
  targetCount: number;
}

export type CriterionStatus = "pass" | "fail" | "unknown";

export interface CriterionResult {
  criterion: string;
  status: CriterionStatus;
  detail: string;
  kind: "required" | "preferred" | "budget" | "deal-breaker" | "delivery";
  points: number;
  maxPoints: number;
}

export type ShortlistRole =
  | "Best overall match"
  | "Best available, needs verification"
  | "Lowest listed price"
  | "Best alternative"
  | "Close contender";

export interface RankedOption {
  product: Product;
  roles: ShortlistRole[];
  score: number;
  maxScore: number;
  eligible: boolean;
  results: CriterionResult[];
  tradeoffs: string[];
}

export interface ConfirmedCartItem {
  productId: string;
  qty: number;
}

export type ProposalKind = "add" | "remove" | "swap";

export interface CartProposal {
  id: string;
  kind: ProposalKind;
  qty: number;
  reason: string;
  productId?: string;
  removeProductId?: string;
  addProductId?: string;
  createdAt: string;
}

export interface Preferences {
  allergens: string[];
  diets: string[];
  weeklyBudget: number;
}

export interface ActivityEntry {
  id: number;
  time: string;
  source: "agent" | "user" | "system";
  tool?: string;
  summary: string;
  outcome?: "success" | "blocked" | "error";
}

export interface GridFilters {
  query: string;
  category: string;
  maxPrice?: number;
  maxKcal?: number;
  minProtein?: number;
  excludeAllergens: string[];
  diets: string[];
  tags: string[];
  agentFiltered: boolean;
  note?: string;
}

export interface ConstraintCheck {
  label: string;
  pass: boolean;
  detail: string;
  violatingIds: string[];
}

export interface CartTotals {
  currencyTotals: CurrencyTotal[];
  kcal: number;
  itemCount: number;
  pendingCount: number;
  proposedCurrencyTotals: CurrencyTotal[];
}

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface ConfirmedPlan {
  totals: CurrencyTotal[];
  itemCount: number;
  at: string;
}

export interface DomainConfig {
  id: DecisionDomain;
  label: string;
  shortLabel: string;
  outcome: string;
  demoRequest: string;
  symbol: string;
  categories: string[];
  preset: DecisionBrief;
}

export interface CatalogAdapter {
  id: string;
  status: DataSourceStatus;
  load(domain: DecisionDomain): Promise<Product[]>;
}
