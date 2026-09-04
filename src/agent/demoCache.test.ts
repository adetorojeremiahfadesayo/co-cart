import { describe, expect, it } from "vitest";
import { matchDemoCache } from "./demoCache";
import { DEMO_DELIVERY_ADDRESS } from "../decision/country";

describe("warmed demo cache", () => {
  const gadgetAnswers = {
    gadget_type: ["wireless headphones"],
    decision_style: ["crowd favourite"],
    store_preference: ["no preference"],
    gadget_priority: ["long battery life"],
    budget: ["50"],
    delivery_address: [DEMO_DELIVERY_ADDRESS],
  };

  it("replays a verified snapshot for its captured brief and delivery country", () => {
    expect(matchDemoCache("gadgets", gadgetAnswers)).toBe("gadgets.json");
    expect(matchDemoCache("gadgets", { ...gadgetAnswers, delivery_address: ["Nigeria"] })).toBe("gadgets.json");
  });

  it("uses live search when any decision differs from the captured brief", () => {
    expect(matchDemoCache("gadgets", { ...gadgetAnswers, gadget_type: ["smartwatch"] })).toBeNull();
    expect(matchDemoCache("gadgets", { ...gadgetAnswers, budget: ["100"] })).toBeNull();
    expect(matchDemoCache("gadgets", { ...gadgetAnswers, delivery_address: ["United States"] })).toBeNull();
  });
});
