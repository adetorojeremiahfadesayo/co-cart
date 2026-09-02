import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store/useStore";
import type { Product } from "../types";
import { executeVoiceTool, getAccessibleSnapshot } from "./tools";

const liveProduct: Product = {
  id: "live-voice-1",
  sourceId: "gid://shopify/ProductVariant/voice-1",
  domain: "gadgets",
  name: "Live voice headphones",
  category: "headphones",
  price: 75,
  currency: "USD",
  merchant: "Verified merchant",
  description: "Verified listing",
  emoji: "G",
  tags: ["audio"],
  demoOnly: false,
};

describe("hands-free app tools", () => {
  beforeEach(() => useStore.getState().resetWorkspace());

  it("reads the category screen and chooses a spoken category", async () => {
    expect(getAccessibleSnapshot().screen).toBe("category chooser");
    await executeVoiceTool("choose_domain", { domain: "gadgets" });
    expect(useStore.getState().domain).toBe("gadgets");
    expect(getAccessibleSnapshot().screen).toBe("decisions");
  });

  it("accepts only exact options offered by the active question", async () => {
    useStore.getState().startDomain("gadgets", false);
    await executeVoiceTool("answer_current_question", { question_id: "gadget_type", values: ["wireless headphones"] });
    expect(useStore.getState().answers.gadget_type).toEqual(["wireless headphones"]);
    await expect(executeVoiceTool("answer_current_question", { question_id: "budget", values: ["make it cheap"] })).rejects.toThrow("offered");
  });

  it("keeps an agent cart change pending until the exact approval phrase", async () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ stage: "results", liveProducts: [liveProduct] });
    await executeVoiceTool("propose_add_to_cart", { product_id: liveProduct.id, quantity: 1, reason: "Matches the brief" });
    expect(useStore.getState().cart).toEqual([]);
    expect(useStore.getState().proposals).toHaveLength(1);
    await expect(executeVoiceTool("approve_all_proposals", { confirmation: "yes" })).rejects.toThrow("exact spoken confirmation");
    expect(useStore.getState().cart).toEqual([]);
    await executeVoiceTool("approve_all_proposals", { confirmation: "approve all changes" });
    expect(useStore.getState().cart).toEqual([{ productId: liveProduct.id, qty: 1 }]);
  });

  it("cannot confirm a plan while proposals are unresolved", async () => {
    useStore.getState().startDomain("gadgets", false);
    useStore.setState({ stage: "results", liveProducts: [liveProduct] });
    await executeVoiceTool("propose_add_to_cart", { product_id: liveProduct.id, quantity: 1, reason: "Matches" });
    await expect(executeVoiceTool("confirm_shopping_plan", { confirmation: "confirm shopping plan" })).rejects.toThrow("still need a human decision");
  });
});
