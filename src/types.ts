export type Category = "dinner" | "lunch" | "breakfast" | "snack" | "dessert";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  kcalPerServing: number;
  servings: number;
  proteinG: number;
  allergens: string[];
  diets: string[];
  tags: string[];
  prepMinutes: number;
  description: string;
  emoji: string;
}

export type CartItemStatus = "confirmed" | "proposed" | "proposed-removal";

export interface CartItem {
  productId: string;
  qty: number;
  status: CartItemStatus;
  source: "user" | "agent";
  reason?: string;
  swappedFromId?: string;
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
}

export interface GridFilters {
  query: string;
  category: "all" | Category;
  maxKcal?: number;
  minProtein?: number;
  maxPrice?: number;
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
  total: number;
  kcal: number;
  itemCount: number;
  pendingCount: number;
}
