import { beforeEach, describe, expect, it } from "vitest";
import { matchDemoCache } from "../agent/demoCache";
import { useStore } from "./useStore";
import type { ClarifyingQuestion, DiscoveryReference, Product, ShoppingBrief } from "../types";

const reference: DiscoveryReference = {
  mode: "text",
  originalText: "a quiet mechanical keyboard under $120",
  interpretedProduct: "quiet mechanical keyboard",
  visibleAttributes: [],
  uncertaintyNotes: ["switch type unknown"],
};

const brief: ShoppingBrief = {
  productType: "mechanical keyboard",
  priorities: ["quiet keys"],
  exclusions: [],
};

const budgetQuestion: ClarifyingQuestion = {
  id: "budget",
  prompt: "What is the budget ceiling?",
  kind: "money",
  field: "budget",
  required: true,
};

const interpretPayload = (questions: ClarifyingQuestion[] = []) => ({ reference, brief, questions });

const liveProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "gen-1",
  sourceId: "gid://shopify/ProductVariant/gen-1",
  domain: "general",
  name: "Live keyboard",
  category: "general",
  price: 99,
  currency: "USD",
  merchant: "Verified merchant",
  description: "Verified listing",
  emoji: "✦",
  tags: [],
  demoOnly: false,
  ...overrides,
});

describe("open discovery workflow", () => {
  beforeEach(() => useStore.getState().resetWorkspace());

  it("moves from entry through interpretation to clarification", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard" });
    expect(useStore.getState()).toMatchObject({ domain: "general", stage: "interpreting", interpretationId: operationId });
    expect(useStore.getState().completeInterpretation(operationId, interpretPayload([budgetQuestion]))).toBe(true);
    expect(useStore.getState().stage).toBe("clarifying");
    expect(useStore.getState().clarifyingQuestions).toHaveLength(1);
  });

  it("skips clarification when the request already answers everything", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard under $120" });
    useStore.getState().completeInterpretation(operationId, interpretPayload());
    expect(useStore.getState().stage).toBe("brief-review");
  });

  it("discards a stale interpretation after a newer request starts", () => {
    const first = useStore.getState().startGeneralDiscovery("text", { text: "first request" });
    useStore.getState().startGeneralDiscovery("text", { text: "second request" });
    expect(useStore.getState().completeInterpretation(first, interpretPayload())).toBe(false);
    expect(useStore.getState().shoppingBrief).toBeNull();
    expect(useStore.getState().stage).toBe("interpreting");
  });

  it("discards a stale failure too", () => {
    const first = useStore.getState().startGeneralDiscovery("text", { text: "first request" });
    useStore.getState().startGeneralDiscovery("text", { text: "second request" });
    expect(useStore.getState().failInterpretation(first, "boom")).toBe(false);
    expect(useStore.getState().interpretationError).toBeNull();
  });

  it("returns to entry with a recoverable error and the pending request kept", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard" });
    expect(useStore.getState().failInterpretation(operationId, "The interpretation service failed. Please try again.")).toBe(true);
    expect(useStore.getState()).toMatchObject({ domain: null, stage: "entry" });
    expect(useStore.getState().interpretationError).toContain("failed");
    expect(useStore.getState().pendingRequest).toMatchObject({ mode: "text", text: "a quiet mechanical keyboard" });
  });

  it("merges clarifying answers into the reviewed brief and requires confirmation", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard" });
    useStore.getState().completeInterpretation(operationId, interpretPayload([budgetQuestion]));
    expect(useStore.getState().confirmShoppingBrief()).toBe(false); // not on the review screen yet
    useStore.getState().setClarifyingAnswer("budget", ["120"], "agent");
    useStore.getState().proceedToBriefReview();
    expect(useStore.getState().stage).toBe("brief-review");
    expect(useStore.getState().shoppingBrief?.budget).toEqual({ amount: 120, currency: "USD" });
    expect(useStore.getState().agentAnswerFlash?.questionId).toBe("budget");
    expect(useStore.getState().confirmShoppingBrief()).toBe(false); // destination is required by Shopify availability filters
    useStore.getState().updateShoppingBrief({ deliveryCountry: "NG" });
    expect(useStore.getState().confirmShoppingBrief()).toBe(true);
    useStore.getState().updateShoppingBrief({ productType: "silent keyboard" });
    expect(useStore.getState().briefConfirmed).toBe(false); // edits require re-confirmation
  });

  it("never matches a general request against the demo snapshot cache", () => {
    expect(matchDemoCache("general", {})).toBeNull();
    expect(matchDemoCache("general", { budget: ["50"] })).toBeNull();
  });

  it("treats general live products as cart-eligible only inside the general session", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard" });
    useStore.getState().completeInterpretation(operationId, interpretPayload());
    useStore.setState({ stage: "results", liveProducts: [liveProduct()] });
    expect(useStore.getState().addToCart("gen-1", 1, "agent", "Matches the confirmed brief").ok).toBe(true);
    expect(useStore.getState().cart).toEqual([]); // proposal pending human approval
    expect(useStore.getState().proposals).toHaveLength(1);
    useStore.getState().startDomain("gadgets", false);
    expect(useStore.getState().addToCart("gen-1", 1, "user").ok).toBe(false);
  });

  it("continues shopping back to the confirmed brief for general searches", () => {
    const operationId = useStore.getState().startGeneralDiscovery("text", { text: "a quiet mechanical keyboard" });
    useStore.getState().completeInterpretation(operationId, interpretPayload());
    useStore.setState({ stage: "results", liveProducts: [liveProduct()] });
    useStore.getState().continueShopping();
    expect(useStore.getState().stage).toBe("brief-review");
    expect(useStore.getState().liveProducts).toHaveLength(1);
    expect(useStore.getState().shoppingBrief).not.toBeNull();
  });
});
