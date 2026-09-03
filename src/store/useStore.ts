import { create } from "zustand";
import { blankBrief, catalogs, DOMAIN_CONFIG } from "../data/catalog";
import type {
  ActivityEntry,
  CartProposal,
  CartTotals,
  ConfirmedPlan,
  ConfirmedCartItem,
  ConstraintCheck,
  DecisionAnswers,
  DecisionBrief,
  DecisionDomain,
  GridFilters,
  AppStage,
  SearchEvent,
  Preferences,
  Product,
} from "../types";
import { formatCurrencyTotals } from "../utils/money";
import { proposeAdd, proposeRemove, proposeSwap, resolveProposal } from "./proposalState";

export const products = Object.values(catalogs).flat();
export const productById = (id: string): Product | undefined =>
  useStore.getState().liveProducts.find((product) => product.id === id && !product.demoOnly);
export const liveProductById = (id: string): Product | undefined =>
  useStore.getState().liveProducts.find((product) => product.id === id && !product.demoOnly);
export const ALLERGENS = ["peanut", "tree-nut", "gluten", "dairy", "soy", "shellfish", "egg", "fish", "sesame"];
export const DIETS = ["vegan", "vegetarian", "gluten-free", "keto", "high-protein"];
export const CATEGORIES = ["all", "dinner", "lunch", "breakfast", "snack", "dessert"];

const makeFilters = (category = "all"): GridFilters => ({
  query: "",
  category,
  excludeAllergens: [],
  diets: [],
  tags: [],
  agentFiltered: false,
});

const defaultPrefs: Preferences = { allergens: [], diets: [], weeklyBudget: 60 };
let activitySeq = 0;
let searchSeq = 0;
const stamp = () => new Date().toLocaleTimeString();

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem("cocart-prefs");
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    // Local storage is optional.
  }
  return defaultPrefs;
}

export function catalogFor(domain: DecisionDomain | null) {
  if (!domain) return [];
  const live = useStore.getState().liveProducts.filter((product) => product.domain === domain);
  return live.length ? live : [];
}

export function filteredProducts(filters: GridFilters, domain = useStore.getState().domain): Product[] {
  const query = filters.query.trim().toLowerCase();
  return catalogFor(domain).filter((product) => {
    if (filters.category !== "all" && product.category !== filters.category) return false;
    if (query) {
      const haystack = `${product.name} ${product.description} ${product.brand ?? ""} ${product.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.maxKcal != null && (product.kcalPerServing == null || product.kcalPerServing > filters.maxKcal)) return false;
    if (filters.minProtein != null && (product.proteinG == null || product.proteinG < filters.minProtein)) return false;
    if (filters.maxPrice != null && product.price > filters.maxPrice) return false;
    if (filters.excludeAllergens.some((item) => (product.allergens ?? []).includes(item))) return false;
    if (filters.diets.length && !filters.diets.every((item) => (product.diets ?? []).includes(item))) return false;
    if (filters.tags.length && !filters.tags.some((item) => product.tags.includes(item))) return false;
    return true;
  });
}

export function projectedCart(cart: ConfirmedCartItem[], proposals: CartProposal[]) {
  return proposals.reduce(
    (state, proposal) => resolveProposal(state, proposal.id, "approve"),
    { cart, proposals },
  ).cart;
}

export function checkConstraints(
  cart: ConfirmedCartItem[],
  opts: { maxTotalPrice?: number; currency?: string; maxKcalPerItem?: number; excludeAllergens?: string[]; minItems?: number },
): ConstraintCheck[] {
  const results: ConstraintCheck[] = [];
  if (opts.maxTotalPrice != null) {
    const currencies = new Set(cart.map((item) => liveProductById(item.productId)?.currency).filter((value): value is string => Boolean(value)));
    const currency = opts.currency?.toUpperCase() ?? (currencies.size === 1 ? [...currencies][0] : null);
    const mismatched = cart.filter((item) => liveProductById(item.productId)?.currency !== currency);
    if (!currency || mismatched.length) {
      results.push({ label: "budget", pass: false, detail: "Budget cannot be compared across mixed or unknown currencies. Supply one currency and use matching products.", violatingIds: mismatched.length ? mismatched.map((item) => item.productId) : cart.map((item) => item.productId) });
    } else {
      const total = cart.reduce((sum, item) => sum + (liveProductById(item.productId)?.price ?? 0) * item.qty, 0);
      const pass = total <= opts.maxTotalPrice;
      results.push({ label: "budget", pass, detail: `Projected listed total ${currency} ${total.toFixed(2)} vs ${currency} ${opts.maxTotalPrice.toFixed(2)} budget; shipping and tax are not included`, violatingIds: pass ? [] : cart.map((item) => item.productId) });
    }
  }
  if (opts.maxKcalPerItem != null) {
    const unknown = cart.filter((item) => liveProductById(item.productId)?.kcalPerServing == null);
    const violating = cart.filter((item) => (liveProductById(item.productId)?.kcalPerServing ?? -Infinity) > opts.maxKcalPerItem!);
    const flagged = [...unknown, ...violating.filter((item) => !unknown.some((unknownItem) => unknownItem.productId === item.productId))];
    results.push({ label: "kcal-per-item", pass: flagged.length === 0, detail: unknown.length ? `${unknown.length} item(s) have no verified calorie data` : violating.length ? `${violating.length} item(s) exceed ${opts.maxKcalPerItem} kcal per serving` : `All listed meals are ${opts.maxKcalPerItem} kcal or less per serving`, violatingIds: flagged.map((item) => item.productId) });
  }
  if (opts.excludeAllergens?.length) {
    const unknown = cart.filter((item) => liveProductById(item.productId)?.allergens == null);
    const violating = cart.filter((item) => opts.excludeAllergens!.some((allergen) => liveProductById(item.productId)?.allergens?.includes(allergen)));
    const flagged = [...unknown, ...violating.filter((item) => !unknown.some((unknownItem) => unknownItem.productId === item.productId))];
    results.push({ label: "allergens", pass: flagged.length === 0, detail: unknown.length ? `${unknown.length} item(s) have no verified allergen data; safety cannot be confirmed` : violating.length ? `${violating.length} item(s) contain excluded allergens` : `No listed items contain: ${opts.excludeAllergens.join(", ")}`, violatingIds: flagged.map((item) => item.productId) });
  }
  if (opts.minItems != null) {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    results.push({ label: "min-items", pass: count >= opts.minItems, detail: `${count} item(s) vs required ${opts.minItems}`, violatingIds: [] });
  }
  return results;
}

export interface StoreState {
  domain: DecisionDomain | null;
  stage: AppStage;
  answers: DecisionAnswers;
  liveProducts: Product[];
  searchEvents: SearchEvent[];
  searchSummary: string;
  searchError: string | null;
  activeSearchId: string | null;
  brief: DecisionBrief | null;
  cart: ConfirmedCartItem[];
  proposals: CartProposal[];
  preferences: Preferences;
  filters: GridFilters;
  activity: ActivityEntry[];
  highlight: { ids: string[]; note?: string; at: number } | null;
  checkedOut: ConfirmedPlan | null;
  cartOpen: boolean;
  startDomain: (domain: DecisionDomain, usePreset?: boolean) => void;
  setDecisionAnswer: (questionId: string, values: string[], source?: "user" | "agent") => void;
  agentAnswerFlash: { questionId: string; at: number } | null;
  beginLiveSearch: () => string | null;
  addSearchEvent: (searchId: string, label: string, detail?: string, status?: SearchEvent["status"]) => void;
  completeLiveSearch: (searchId: string, products: Product[], summary: string) => boolean;
  failLiveSearch: (searchId: string, message: string) => boolean;
  returnToDecisions: () => void;
  continueShopping: () => void;
  resetWorkspace: () => void;
  updateBrief: (patch: Partial<DecisionBrief>) => void;
  log: (source: ActivityEntry["source"], summary: string, tool?: string, outcome?: ActivityEntry["outcome"]) => void;
  setFilter: (patch: Partial<GridFilters>) => void;
  clearFilters: () => void;
  addToCart: (productId: string, qty?: number, source?: "user" | "agent", reason?: string) => { ok: boolean; message: string; proposalId?: string };
  removeFromCart: (productId: string, source?: "user" | "agent", reason?: string) => { ok: boolean; message: string; proposalId?: string };
  updateQty: (productId: string, qty: number) => void;
  swapItems: (removeProductId: string, addProductId: string, reason: string) => { ok: boolean; message: string; proposalId?: string };
  approveProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;
  approveAll: () => number;
  rejectAll: () => number;
  setPreferences: (patch: Partial<Preferences>, source?: "user" | "agent") => void;
  setHighlight: (ids: string[], note?: string) => void;
  clearHighlight: () => void;
  checkout: (source?: "user" | "agent") => { ok: boolean; message: string };
  newShop: () => void;
  setCartOpen: (open: boolean) => void;
  cartTotals: () => CartTotals;
}

export const useStore = create<StoreState>((set, get) => ({
  domain: null,
  stage: "decisions",
  answers: {},
  liveProducts: [],
  searchEvents: [],
  searchSummary: "",
  searchError: null,
  activeSearchId: null,
  brief: null,
  cart: [],
  proposals: [],
  preferences: loadPrefs(),
  filters: makeFilters(),
  activity: [],
  highlight: null,
  checkedOut: null,
  cartOpen: false,

  startDomain: (domain, usePreset = false) => {
    const brief = usePreset ? structuredClone(DOMAIN_CONFIG[domain].preset) : blankBrief();
    const initialCategory = usePreset ? (DOMAIN_CONFIG[domain].categories[1] ?? "all") : "all";
    set({ domain, stage: "decisions", answers: {}, liveProducts: [], searchEvents: [], searchSummary: "", searchError: null, activeSearchId: null, brief, cart: [], proposals: [], filters: makeFilters(initialCategory), highlight: null, checkedOut: null, cartOpen: false, agentAnswerFlash: null });
    get().log("user", `Selected ${DOMAIN_CONFIG[domain].label}`);
  },
  setDecisionAnswer: (questionId, values, source = "user") => set((state) => ({
    answers: { ...state.answers, [questionId]: values },
    agentAnswerFlash: source === "agent" ? { questionId, at: Date.now() } : state.agentAnswerFlash,
  })),
  agentAnswerFlash: null,
  beginLiveSearch: () => {
    if (get().stage === "searching") return null;
    const activeSearchId = `search-${Date.now()}-${++searchSeq}`;
    set({ activeSearchId, stage: "searching", searchEvents: [{ id: Date.now(), label: "Starting OpenAI shopping agent", detail: "Preparing your decision brief", status: "active" }], searchSummary: "", searchError: null, highlight: null });
    return activeSearchId;
  },
  addSearchEvent: (searchId, label, detail, status = "active") => set((state) => state.activeSearchId !== searchId ? state : ({
    searchEvents: [...state.searchEvents.map((event) => event.status === "active" ? { ...event, status: "done" as const } : event), { id: Date.now() + state.searchEvents.length, label, detail, status }],
  })),
  completeLiveSearch: (searchId, liveProducts, searchSummary) => {
    if (get().activeSearchId !== searchId || get().stage !== "searching") return false;
    set((state) => {
      const knownSources = new Set(state.liveProducts.map((product) => product.sourceId ?? product.id));
      const newProducts = liveProducts.filter((product) => !knownSources.has(product.sourceId ?? product.id));
      return { activeSearchId: null, stage: "results", liveProducts: [...state.liveProducts, ...newProducts], searchSummary, searchError: null, filters: makeFilters(), searchEvents: state.searchEvents.map((event) => event.status === "active" ? { ...event, status: "done" as const } : event) };
    });
    return true;
  },
  failLiveSearch: (searchId, searchError) => {
    if (get().activeSearchId !== searchId || get().stage !== "searching") return false;
    set((state) => ({ activeSearchId: null, stage: "error", searchError, searchEvents: [...state.searchEvents.map((event) => event.status === "active" ? { ...event, status: "done" as const } : event), { id: Date.now(), label: "Live search stopped", detail: searchError, status: "error" }] }));
    return true;
  },
  returnToDecisions: () => set({ activeSearchId: null, stage: "decisions", liveProducts: [], searchEvents: [], searchSummary: "", searchError: null, cart: [], proposals: [], highlight: null }),
  continueShopping: () => {
    set({ activeSearchId: null, stage: "decisions", searchEvents: [], searchSummary: "", searchError: null, highlight: null });
    get().log("user", "Continued shopping with earlier options and cart preserved");
  },
  resetWorkspace: () => set({ domain: null, stage: "decisions", answers: {}, liveProducts: [], searchEvents: [], searchSummary: "", searchError: null, activeSearchId: null, brief: null, cart: [], proposals: [], filters: makeFilters(), highlight: null, checkedOut: null, cartOpen: false, agentAnswerFlash: null }),
  updateBrief: (patch) => set((state) => ({ brief: state.brief ? { ...state.brief, ...patch } : state.brief })),
  log: (source, summary, tool, outcome) => set((state) => ({ activity: [{ id: ++activitySeq, time: stamp(), source, summary, tool, outcome }, ...state.activity].slice(0, 200) })),
  setFilter: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  clearFilters: () => set({ filters: makeFilters() }),

  addToCart: (productId, qty = 1, source = "user", reason = "Selected by the agent") => {
    const product = liveProductById(productId);
    if (!product || product.domain !== get().domain) return { ok: false, message: `Unknown product id "${productId}" for the active category.` };
    if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 99) return { ok: false, message: "Quantity must be a whole number from 1 to 99." };
    if (source === "agent") {
      set((state) => proposeAdd(state, productId, qty, reason));
      const proposalId = get().proposals.at(-1)?.id;
      return { ok: true, proposalId, message: `Proposed adding ${product.name} ×${qty}—the confirmed cart is unchanged until approval.` };
    }
    set((state) => {
      const found = state.cart.find((item) => item.productId === productId);
      return { cart: found ? state.cart.map((item) => item.productId === productId ? { ...item, qty: item.qty + qty } : item) : [...state.cart, { productId, qty }] };
    });
    get().log("user", `Added ${product.name} ×${qty}`);
    return { ok: true, message: `Added ${product.name} ×${qty}.` };
  },

  removeFromCart: (productId, source = "user", reason = "Agent recommends removing this item") => {
    const item = get().cart.find((line) => line.productId === productId);
    const product = liveProductById(productId);
    if (!item) return { ok: false, message: `${product?.name ?? productId} is not in the confirmed cart.` };
    if (source === "agent") {
      set((state) => proposeRemove(state, productId, item.qty, reason));
      return { ok: true, proposalId: get().proposals.at(-1)?.id, message: `Proposed removing ${product?.name ?? productId}; it remains confirmed until approval.` };
    }
    set((state) => ({ cart: state.cart.filter((line) => line.productId !== productId) }));
    get().log("user", `Removed ${product?.name ?? productId}`);
    return { ok: true, message: `Removed ${product?.name ?? productId}.` };
  },

  updateQty: (productId, qty) => {
    if (!Number.isSafeInteger(qty) || qty > 99) return;
    if (qty <= 0) return void get().removeFromCart(productId, "user");
    if (!liveProductById(productId) || !get().cart.some((item) => item.productId === productId)) return;
    set((state) => ({ cart: state.cart.map((item) => item.productId === productId ? { ...item, qty } : item) }));
    get().log("user", `Changed ${productById(productId)?.name ?? productId} quantity to ${qty}`);
  },

  swapItems: (removeProductId, addProductId, reason) => {
    const from = liveProductById(removeProductId);
    const to = liveProductById(addProductId);
    const item = get().cart.find((line) => line.productId === removeProductId);
    if (!from || !item) return { ok: false, message: `The original product is not in the confirmed cart.` };
    if (!to || to.domain !== get().domain) return { ok: false, message: `Unknown replacement product for the active category.` };
    set((state) => proposeSwap(state, removeProductId, addProductId, item.qty, reason));
    return { ok: true, proposalId: get().proposals.at(-1)?.id, message: `Proposed swap: ${from.name} → ${to.name}. ${from.name} remains confirmed until approval.` };
  },

  approveProposal: (proposalId) => {
    const proposal = get().proposals.find((item) => item.id === proposalId);
    if (!proposal) return;
    set((state) => resolveProposal(state, proposalId, "approve"));
    get().log("user", `Approved ${proposal.kind} proposal`);
  },
  rejectProposal: (proposalId) => {
    const proposal = get().proposals.find((item) => item.id === proposalId);
    if (!proposal) return;
    set((state) => resolveProposal(state, proposalId, "reject"));
    get().log("user", `Rejected ${proposal.kind} proposal; confirmed cart kept intact`);
  },
  approveAll: () => {
    const ids = get().proposals.map((item) => item.id);
    if (ids.length) {
      set((state) => {
        const resolved = ids.reduce(
          (next, id) => resolveProposal(next, id, "approve"),
          { cart: state.cart, proposals: state.proposals },
        );
        return { cart: resolved.cart, proposals: resolved.proposals };
      });
    }
    if (ids.length) get().log("user", `Approved all ${ids.length} pending change(s)`);
    return ids.length;
  },
  rejectAll: () => {
    const ids = get().proposals.map((item) => item.id);
    if (ids.length) set({ proposals: [] });
    if (ids.length) get().log("user", `Rejected all ${ids.length} pending change(s)`);
    return ids.length;
  },

  setPreferences: (patch, source = "user") => {
    set((state) => {
      const preferences = { ...state.preferences, ...patch };
      try { localStorage.setItem("cocart-prefs", JSON.stringify(preferences)); } catch { /* optional */ }
      return { preferences };
    });
    if (source === "user") get().log("user", "Updated shopping preferences");
  },
  setHighlight: (ids, note) => set({ highlight: { ids: ids.filter((id) => liveProductById(id)?.domain === get().domain), note, at: Date.now() } }),
  clearHighlight: () => set({ highlight: null }),

  checkout: (source = "user") => {
    const state = get();
    if (state.proposals.length) return { ok: false, message: `Checkout blocked: ${state.proposals.length} agent proposal(s) still need a human decision.` };
    if (!state.cart.length) return { ok: false, message: "Cart is empty—nothing to check out." };
    const totals = state.cartTotals();
    set({ checkedOut: { totals: totals.currencyTotals, itemCount: totals.itemCount, at: stamp() } });
    const listedTotal = formatCurrencyTotals(totals.currencyTotals);
    if (source === "user") state.log("system", `Shopping plan confirmed—${listedTotal}, ${totals.itemCount} item(s)`);
    return { ok: true, message: `Shopping plan confirmed. No purchase was made. Listed subtotal: ${listedTotal}.` };
  },
  newShop: () => set({ domain: null, stage: "decisions", answers: {}, liveProducts: [], searchEvents: [], searchSummary: "", searchError: null, activeSearchId: null, brief: null, cart: [], proposals: [], filters: makeFilters(), activity: [], highlight: null, checkedOut: null, cartOpen: false, agentAnswerFlash: null }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  cartTotals: () => {
    const state = get();
    const calculate = (cart: ConfirmedCartItem[]) => cart.reduce((totals, item) => {
      const product = liveProductById(item.productId);
      if (!product) return totals;
      const currency = product.currency ?? "USD";
      totals.byCurrency.set(currency, (totals.byCurrency.get(currency) ?? 0) + product.price * item.qty);
      totals.kcal += (product.kcalPerServing ?? 0) * item.qty;
      totals.itemCount += item.qty;
      return totals;
    }, { byCurrency: new Map<string, number>(), kcal: 0, itemCount: 0 });
    const confirmed = calculate(state.cart);
    const projected = calculate(projectedCart(state.cart, state.proposals));
    const toTotals = (values: Map<string, number>) => [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => ({ currency, total }));
    return { currencyTotals: toTotals(confirmed.byCurrency), kcal: confirmed.kcal, itemCount: confirmed.itemCount, pendingCount: state.proposals.length, proposedCurrencyTotals: toTotals(projected.byCurrency) };
  },
}));
