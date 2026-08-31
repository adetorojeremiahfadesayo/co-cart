import { create } from "zustand";
import productsData from "../data/products.json";
import type {
  ActivityEntry,
  CartItem,
  CartTotals,
  Category,
  ConstraintCheck,
  GridFilters,
  Preferences,
  Product,
} from "../types";

export const products = productsData as Product[];

export const productById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);

export const CATEGORIES: ("all" | Category)[] = [
  "all",
  "dinner",
  "lunch",
  "breakfast",
  "snack",
  "dessert",
];

export const ALLERGENS = [
  "peanut",
  "tree-nut",
  "gluten",
  "dairy",
  "soy",
  "shellfish",
  "egg",
  "fish",
  "sesame",
];

export const DIETS = ["vegan", "vegetarian", "gluten-free", "keto", "high-protein"];

const defaultFilters: GridFilters = {
  query: "",
  category: "all",
  excludeAllergens: [],
  diets: [],
  tags: [],
  agentFiltered: false,
};

const defaultPrefs: Preferences = {
  allergens: [],
  diets: [],
  weeklyBudget: 60,
};

let activitySeq = 0;
const stamp = () => new Date().toLocaleTimeString();

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem("cocart-prefs");
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultPrefs;
}

function loadSpeakFlag(): boolean {
  try {
    return localStorage.getItem("cocart-speak") === "1";
  } catch {
    return false;
  }
}

export interface StoreState {
  cart: CartItem[];
  preferences: Preferences;
  filters: GridFilters;
  activity: ActivityEntry[];
  highlight: { ids: string[]; note?: string; at: number } | null;
  checkedOut: { total: number; itemCount: number; at: string } | null;
  cartOpen: boolean;
  speakProposals: boolean;

  log: (source: ActivityEntry["source"], summary: string, tool?: string) => void;
  setFilter: (patch: Partial<GridFilters>, source?: "user" | "agent") => void;
  clearFilters: () => void;
  addToCart: (
    productId: string,
    qty?: number,
    source?: "user" | "agent",
    reason?: string,
    swappedFromId?: string,
  ) => { ok: boolean; message: string };
  removeFromCart: (
    productId: string,
    source?: "user" | "agent",
    reason?: string,
  ) => { ok: boolean; message: string };
  updateQty: (productId: string, qty: number) => void;
  swapItems: (
    removeProductId: string,
    addProductId: string,
    reason: string,
  ) => { ok: boolean; message: string };
  approveItem: (productId: string) => void;
  rejectItem: (productId: string) => void;
  approveAll: () => number;
  rejectAll: () => number;
  setPreferences: (patch: Partial<Preferences>) => void;
  setHighlight: (ids: string[], note?: string) => void;
  clearHighlight: () => void;
  checkout: () => { ok: boolean; message: string };
  newShop: () => void;
  setCartOpen: (open: boolean) => void;
  setSpeakProposals: (on: boolean) => void;
  cartTotals: () => CartTotals;
}

export function filteredProducts(filters: GridFilters): Product[] {
  const q = filters.query.trim().toLowerCase();
  return products.filter((p) => {
    if (filters.category !== "all" && p.category !== filters.category) return false;
    if (q) {
      const hay = `${p.name} ${p.description} ${p.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.maxKcal != null && p.kcalPerServing > filters.maxKcal) return false;
    if (filters.minProtein != null && p.proteinG < filters.minProtein) return false;
    if (filters.maxPrice != null && p.price > filters.maxPrice) return false;
    if (filters.excludeAllergens.some((a) => p.allergens.includes(a))) return false;
    if (filters.diets.length > 0 && !filters.diets.every((d) => p.diets.includes(d)))
      return false;
    if (filters.tags.length > 0 && !filters.tags.some((t) => p.tags.includes(t)))
      return false;
    return true;
  });
}

export function checkConstraints(
  cart: CartItem[],
  opts: {
    maxTotalPrice?: number;
    maxKcalPerItem?: number;
    excludeAllergens?: string[];
    minItems?: number;
  },
): ConstraintCheck[] {
  const active = cart.filter((i) => i.status !== "proposed-removal");
  const results: ConstraintCheck[] = [];

  if (opts.maxTotalPrice != null) {
    const total = active.reduce(
      (sum, i) => sum + (productById(i.productId)?.price ?? 0) * i.qty,
      0,
    );
    const pass = total <= opts.maxTotalPrice;
    results.push({
      label: "budget",
      pass,
      detail: `Cart total $${total.toFixed(2)} vs budget $${opts.maxTotalPrice.toFixed(2)}`,
      violatingIds: pass
        ? []
        : active.map((i) => i.productId), // any item could be the trade-off
    });
  }
  if (opts.maxKcalPerItem != null) {
    const violators = active.filter(
      (i) => (productById(i.productId)?.kcalPerServing ?? 0) > opts.maxKcalPerItem!,
    );
    results.push({
      label: "kcal-per-item",
      pass: violators.length === 0,
      detail:
        violators.length === 0
          ? `All items are ${opts.maxKcalPerItem} kcal or less per serving`
          : `${violators.length} item(s) exceed ${opts.maxKcalPerItem} kcal per serving`,
      violatingIds: violators.map((i) => i.productId),
    });
  }
  if (opts.excludeAllergens && opts.excludeAllergens.length > 0) {
    const violators = active.filter((i) => {
      const p = productById(i.productId);
      return p && opts.excludeAllergens!.some((a) => p.allergens.includes(a));
    });
    results.push({
      label: "allergens",
      pass: violators.length === 0,
      detail:
        violators.length === 0
          ? `No items contain: ${opts.excludeAllergens.join(", ")}`
          : `${violators.length} item(s) contain excluded allergens`,
      violatingIds: violators.map((i) => i.productId),
    });
  }
  if (opts.minItems != null) {
    const pass = active.length >= opts.minItems;
    results.push({
      label: "min-items",
      pass,
      detail: `${active.length} distinct item(s) in cart vs required ${opts.minItems}`,
      violatingIds: [],
    });
  }
  return results;
}

export const useStore = create<StoreState>((set, get) => ({
  cart: [],
  preferences: loadPrefs(),
  filters: defaultFilters,
  activity: [],
  highlight: null,
  checkedOut: null,
  cartOpen: false,
  speakProposals: loadSpeakFlag(),

  log: (source, summary, tool) =>
    set((s) => ({
      activity: [
        { id: ++activitySeq, time: stamp(), source, summary, tool },
        ...s.activity,
      ].slice(0, 200),
    })),

  setFilter: (patch, source = "user") => {
    set((s) => ({
      filters: { ...s.filters, ...patch },
    }));
    if (source === "agent") {
      const bits: string[] = [];
      const f = { ...get().filters };
      if (f.query) bits.push(`query "${f.query}"`);
      if (f.category !== "all") bits.push(`category ${f.category}`);
      if (f.maxKcal != null) bits.push(`≤ ${f.maxKcal} kcal`);
      if (f.minProtein != null) bits.push(`≥ ${f.minProtein}g protein`);
      if (f.maxPrice != null) bits.push(`≤ $${f.maxPrice}`);
      if (f.excludeAllergens.length) bits.push(`no ${f.excludeAllergens.join(", ")}`);
      if (f.diets.length) bits.push(`diets: ${f.diets.join(", ")}`);
      if (f.tags.length) bits.push(`tags: ${f.tags.join(", ")}`);
      get().log("agent", `Filtered product grid (${bits.join("; ") || "all products"})`, "search-products");
    }
  },

  clearFilters: () => set({ filters: { ...defaultFilters } }),

  addToCart: (productId, qty = 1, source = "user", reason, swappedFromId) => {
    const p = productById(productId);
    if (!p) return { ok: false, message: `Unknown product id "${productId}".` };
    const status = source === "agent" ? "proposed" : "confirmed";
    set((s) => {
      const existing = s.cart.find((i) => i.productId === productId);
      if (existing) {
        return {
          cart: s.cart.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  qty: i.qty + qty,
                  status: source === "agent" ? "proposed" : i.status,
                  source,
                  reason: reason ?? i.reason,
                }
              : i,
          ),
        };
      }
      return {
        cart: [
          ...s.cart,
          { productId, qty, status, source, reason, swappedFromId },
        ],
      };
    });
    const msg =
      source === "agent"
        ? `Proposed ${p.name} ×${qty} — pending your approval${reason ? ` (${reason})` : ""}.`
        : `Added ${p.name} ×${qty} to your cart.`;
    get().log(source, source === "agent" ? `Proposed add: ${p.name} ×${qty}${reason ? ` — ${reason}` : ""}` : `Added ${p.name} ×${qty}`, source === "agent" ? "add-to-cart" : undefined);
    return { ok: true, message: msg };
  },

  removeFromCart: (productId, source = "user", reason) => {
    const p = productById(productId);
    const item = get().cart.find((i) => i.productId === productId);
    if (!item) return { ok: false, message: `Product ${productId} is not in the cart.` };
    if (source === "agent" && item.source === "user" && item.status === "confirmed") {
      set((s) => ({
        cart: s.cart.map((i) =>
          i.productId === productId
            ? { ...i, status: "proposed-removal", reason }
            : i,
        ),
      }));
      get().log("agent", `Proposed removal: ${p?.name ?? productId}${reason ? ` — ${reason}` : ""}`, "remove-from-cart");
      return {
        ok: true,
        message: `Proposed removing ${p?.name ?? productId} (added by you) — pending your approval.`,
      };
    }
    set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId) }));
    get().log(source, `Removed ${p?.name ?? productId}`, source === "agent" ? "remove-from-cart" : undefined);
    return { ok: true, message: `Removed ${p?.name ?? productId} from the cart.` };
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId, "user");
      return;
    }
    set((s) => ({
      cart: s.cart.map((i) => (i.productId === productId ? { ...i, qty } : i)),
    }));
  },

  swapItems: (removeProductId, addProductId, reason) => {
    const from = productById(removeProductId);
    const to = productById(addProductId);
    if (!from) return { ok: false, message: `Unknown product id "${removeProductId}".` };
    if (!to) return { ok: false, message: `Unknown product id "${addProductId}".` };
    const inCart = get().cart.find((i) => i.productId === removeProductId);
    const qty = inCart?.qty ?? 1;
    set((s) => ({ cart: s.cart.filter((i) => i.productId !== removeProductId) }));
    get().addToCart(addProductId, qty, "agent", reason, removeProductId);
    get().log("agent", `Swap: ${from.name} → ${to.name} — ${reason}`, "swap-item");
    return {
      ok: true,
      message: `Proposed swap: ${from.name} → ${to.name} (${reason}) — pending your approval.`,
    };
  },

  approveItem: (productId) => {
    const item = get().cart.find((i) => i.productId === productId);
    if (!item) return;
    if (item.status === "proposed-removal") {
      set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId) }));
      get().log("user", `Approved removal of ${productById(productId)?.name ?? productId}`);
    } else {
      set((s) => ({
        cart: s.cart.map((i) =>
          i.productId === productId
            ? { ...i, status: "confirmed", reason: undefined }
            : i,
        ),
      }));
      get().log("user", `Approved ${productById(productId)?.name ?? productId}`);
    }
  },

  rejectItem: (productId) => {
    const item = get().cart.find((i) => i.productId === productId);
    if (!item) return;
    if (item.status === "proposed-removal") {
      set((s) => ({
        cart: s.cart.map((i) =>
          i.productId === productId
            ? { ...i, status: "confirmed", reason: undefined }
            : i,
        ),
      }));
      get().log("user", `Rejected removal of ${productById(productId)?.name ?? productId} — kept in cart`);
    } else {
      set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId) }));
      get().log("user", `Rejected ${productById(productId)?.name ?? productId}`);
    }
  },

  approveAll: () => {
    const pending = get().cart.filter((i) => i.status !== "confirmed");
    pending.forEach((i) => get().approveItem(i.productId));
    if (pending.length) get().log("user", `Approved all ${pending.length} pending change(s)`);
    return pending.length;
  },

  rejectAll: () => {
    const pending = get().cart.filter((i) => i.status !== "confirmed");
    pending.forEach((i) => get().rejectItem(i.productId));
    if (pending.length) get().log("user", `Rejected all ${pending.length} pending change(s)`);
    return pending.length;
  },

  setPreferences: (patch) => {
    set((s) => {
      const preferences = { ...s.preferences, ...patch };
      try {
        localStorage.setItem("cocart-prefs", JSON.stringify(preferences));
      } catch {
        /* ignore */
      }
      return { preferences };
    });
    const p = get().preferences;
    get().log(
      "agent",
      `Preferences saved — allergens: ${p.allergens.join(", ") || "none"}; diets: ${p.diets.join(", ") || "none"}; budget: $${p.weeklyBudget}`,
      "set-preferences",
    );
  },

  setHighlight: (ids, note) => {
    const valid = ids.filter((id) => productById(id));
    set({ highlight: { ids: valid, note, at: Date.now() } });
    get().log(
      "agent",
      `Highlighted ${valid.length} product(s)${note ? ` — ${note}` : ""}`,
      "highlight-products",
    );
  },

  clearHighlight: () => set({ highlight: null }),

  checkout: () => {
    const s = get();
    const pending = s.cart.filter((i) => i.status !== "confirmed");
    if (pending.length > 0) {
      return {
        ok: false,
        message: `Checkout blocked: ${pending.length} proposed change(s) are still awaiting the user's approval. Ask the user to approve or reject them first.`,
      };
    }
    if (s.cart.length === 0) {
      return { ok: false, message: "Cart is empty — nothing to check out." };
    }
    const totals = s.cartTotals();
    set({
      checkedOut: { total: totals.total, itemCount: totals.itemCount, at: stamp() },
    });
    s.log("system", `Checkout complete — $${totals.total.toFixed(2)}, ${totals.itemCount} item(s)`);
    return {
      ok: true,
      message: `Checkout complete! Total $${totals.total.toFixed(2)} for ${totals.itemCount} item(s).`,
    };
  },

  newShop: () => set({ checkedOut: null, cart: [], highlight: null }),

  setCartOpen: (open) => set({ cartOpen: open }),

  setSpeakProposals: (on) => {
    set({ speakProposals: on });
    try {
      localStorage.setItem("cocart-speak", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  },

  cartTotals: () => {
    const cart = get().cart.filter((i) => i.status !== "proposed-removal");
    let total = 0;
    let kcal = 0;
    let qtyCount = 0;
    for (const i of cart) {
      const p = productById(i.productId);
      if (!p) continue;
      total += p.price * i.qty;
      kcal += p.kcalPerServing * i.qty;
      qtyCount += i.qty;
    }
    return {
      total,
      kcal,
      itemCount: qtyCount,
      pendingCount: get().cart.filter((i) => i.status !== "confirmed").length,
    };
  },
}));
