import { beforeEach, describe, expect, it } from "vitest";
import { checkConstraints, products, useStore } from "./useStore";
import type { Product } from "../types";

const liveProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "live-1",
  sourceId: "gid://shopify/ProductVariant/1",
  domain: "gadgets",
  name: "Live headphones",
  category: "gadgets",
  price: 25,
  currency: "USD",
  merchant: "Live merchant",
  description: "Verified listing",
  emoji: "G",
  tags: [],
  demoOnly: false,
  ...overrides,
});

describe("live workflow guards", () => {
  beforeEach(() => useStore.getState().resetWorkspace());

  it("rejects seeded demo products from active cart actions", () => {
    useStore.getState().startDomain("gadgets", false);
    const seeded = products.find((product) => product.domain === "gadgets")!;
    expect(useStore.getState().addToCart(seeded.id, 1, "agent", "test").ok).toBe(false);
  });

  it("accepts a current verified live product", () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ liveProducts: [liveProduct()] });
    expect(useStore.getState().addToCart("live-1", 1, "user").ok).toBe(true);
  });

  it("keeps earlier options and cart items when choosing more", () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ stage: "results", liveProducts: [liveProduct()], cart: [{ productId: "live-1", qty: 1 }] });
    useStore.getState().continueShopping();
    expect(useStore.getState()).toMatchObject({ stage: "decisions", cart: [{ productId: "live-1", qty: 1 }] });
    expect(useStore.getState().liveProducts).toHaveLength(1);
  });

  it("merges newly verified options without duplicating an earlier source", () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ liveProducts: [liveProduct()] });
    const searchId = useStore.getState().beginLiveSearch()!;
    useStore.getState().completeLiveSearch(searchId, [
      liveProduct({ id: "duplicate-id" }),
      liveProduct({ id: "live-2", sourceId: "gid://shopify/ProductVariant/2" }),
    ], "more");
    expect(useStore.getState().liveProducts.map((product) => product.id)).toEqual(["live-1", "live-2"]);
  });

  it("records when results come from a warmed verified snapshot", () => {
    useStore.getState().startDomain("gadgets", false);
    const searchId = useStore.getState().beginLiveSearch()!;
    useStore.getState().completeLiveSearch(searchId, [liveProduct()], "snapshot", "warmed-snapshot");
    expect(useStore.getState().searchSource).toBe("warmed-snapshot");
  });

  it("discards completion from a stale search after the category changes", () => {
    useStore.getState().startDomain("gadgets", false);
    const searchId = useStore.getState().beginLiveSearch()!;
    useStore.getState().startDomain("clothing", false);
    expect(useStore.getState().completeLiveSearch(searchId, [liveProduct()], "stale")).toBe(false);
    expect(useStore.getState().domain).toBe("clothing");
    expect(useStore.getState().liveProducts).toEqual([]);
  });

  it("keeps currency totals separate", () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ liveProducts: [liveProduct(), liveProduct({ id: "live-2", currency: "NGN", price: 1000 })], cart: [{ productId: "live-1", qty: 1 }, { productId: "live-2", qty: 2 }] });
    expect(useStore.getState().cartTotals().currencyTotals).toEqual([{ currency: "NGN", total: 2000 }, { currency: "USD", total: 25 }]);
  });

  it("flags agent-set decision answers for UI highlight but not shopper answers", () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.getState().setDecisionAnswer("gadget_type", ["smartwatch"], "agent");
    expect(useStore.getState().agentAnswerFlash?.questionId).toBe("gadget_type");
    useStore.getState().setDecisionAnswer("budget", ["50"]);
    expect(useStore.getState().agentAnswerFlash?.questionId).toBe("gadget_type");
    useStore.getState().resetWorkspace();
    expect(useStore.getState().agentAnswerFlash).toBeNull();
  });

  it("treats missing allergen metadata as unknown rather than safe", () => {
    useStore.getState().startDomain("meals", false);
    useStore.setState({ liveProducts: [liveProduct({ id: "meal-1", domain: "meals" })] });
    const result = checkConstraints([{ productId: "meal-1", qty: 1 }], { excludeAllergens: ["peanut"] })[0];
    expect(result.pass).toBe(false);
    expect(result.detail).toContain("no verified allergen data");
  });
});
