import { describe, expect, it } from "vitest";
import {
  applyClarifyingAnswers,
  briefSignature,
  isValidClarifyingAnswer,
  normalizeClarifyingQuestions,
  shoppingBriefToText,
  validateDiscoveryText,
  validateShoppingBrief,
} from "./shoppingBrief";
import type { ClarifyingQuestion, ShoppingBrief } from "../types";

const baseBrief: ShoppingBrief = {
  productType: "mechanical keyboard",
  useCase: "quiet typing in a shared office",
  priorities: ["quiet keys"],
  exclusions: [],
};

describe("validateDiscoveryText", () => {
  it("accepts a plain-language request between 3 and 500 characters", () => {
    expect(validateDiscoveryText("  a quiet keyboard  ")).toBe("a quiet keyboard");
    expect(validateDiscoveryText("ab")).toBeNull();
    expect(validateDiscoveryText("x".repeat(501))).toBeNull();
    expect(validateDiscoveryText(42)).toBeNull();
  });
});

describe("validateShoppingBrief", () => {
  it("accepts a minimal brief and rejects missing product type", () => {
    expect(validateShoppingBrief({ productType: "running shoes", priorities: [], exclusions: [] })).toMatchObject({ productType: "running shoes" });
    expect(validateShoppingBrief({ priorities: [] })).toBeNull();
    expect(validateShoppingBrief({ productType: "k" })).toBeNull();
  });

  it("validates budget shape and currency", () => {
    expect(validateShoppingBrief({ productType: "keyboard", priorities: [], exclusions: [], budget: { amount: 120, currency: "USD" } })).toMatchObject({ budget: { amount: 120, currency: "USD" } });
    expect(validateShoppingBrief({ productType: "keyboard", priorities: [], exclusions: [], budget: { amount: -5, currency: "USD" } })).toBeNull();
    expect(validateShoppingBrief({ productType: "keyboard", priorities: [], exclusions: [], budget: { amount: 10, currency: "US D" } })).toBeNull();
  });

  it("rejects unknown delivery countries and over-long lists", () => {
    expect(validateShoppingBrief({ productType: "keyboard", priorities: [], exclusions: [], deliveryCountry: "XX" })).toBeNull();
    expect(validateShoppingBrief({ productType: "keyboard", priorities: Array(9).fill("p"), exclusions: [] })).toBeNull();
  });
});

describe("normalizeClarifyingQuestions", () => {
  it("keeps valid questions and drops malformed ones", () => {
    const questions = normalizeClarifyingQuestions([
      { id: "budget", prompt: "Budget?", kind: "money", field: "budget", options: [], required: true },
      { id: "budget", prompt: "Duplicate id", kind: "text", field: "useCase", options: [], required: false },
      { id: "bad kind", prompt: "Wrong kind", kind: "slider", field: "budget", options: [], required: false },
      { id: "style", prompt: "Style?", kind: "single", field: "decisionStyle", options: [{ value: "best value", label: "Best value" }], required: false },
      { prompt: "No id", kind: "text", field: "useCase" },
    ]);
    expect(questions.map((question) => question.id)).toEqual(["budget"]);
  });

  it("caps the set at five questions", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ id: `q${index}`, prompt: `Question ${index}?`, kind: "text", field: "useCase", options: [], required: false }));
    expect(normalizeClarifyingQuestions(many)).toHaveLength(5);
  });

  it("requires real options for choice questions", () => {
    expect(normalizeClarifyingQuestions([{ id: "a", prompt: "Pick", kind: "single", field: "decisionStyle", options: [], required: true }])).toEqual([]);
  });
});

describe("isValidClarifyingAnswer", () => {
  const money: ClarifyingQuestion = { id: "budget", prompt: "Budget?", kind: "money", field: "budget", required: true };
  const single: ClarifyingQuestion = { id: "style", prompt: "Style?", kind: "single", field: "decisionStyle", required: false, options: [{ value: "best value", label: "Best value" }, { value: "hidden gem", label: "Hidden gem" }] };

  it("validates money amounts", () => {
    expect(isValidClarifyingAnswer(money, ["120"])).toBe(true);
    expect(isValidClarifyingAnswer(money, ["0"])).toBe(false);
    expect(isValidClarifyingAnswer(money, ["abc"])).toBe(false);
    expect(isValidClarifyingAnswer(money, [])).toBe(false);
  });

  it("accepts only offered options for choice questions", () => {
    expect(isValidClarifyingAnswer(single, ["best value"])).toBe(true);
    expect(isValidClarifyingAnswer(single, ["cheapest ever"])).toBe(false);
    expect(isValidClarifyingAnswer(single, ["best value", "hidden gem"])).toBe(false);
  });
});

describe("applyClarifyingAnswers", () => {
  it("merges answers into the matching brief fields only", () => {
    const questions: ClarifyingQuestion[] = [
      { id: "budget", prompt: "Budget?", kind: "money", field: "budget", required: true },
      { id: "avoid", prompt: "Avoid?", kind: "text", field: "exclusions", required: false },
      { id: "style", prompt: "Style?", kind: "single", field: "decisionStyle", required: false, options: [{ value: "best value", label: "Best value" }, { value: "hidden gem", label: "Hidden gem" }] },
    ];
    const merged = applyClarifyingAnswers(baseBrief, questions, {
      budget: ["120"],
      avoid: ["bluetooth only"],
      style: ["best value"],
    });
    expect(merged.budget).toEqual({ amount: 120, currency: "USD" });
    expect(merged.exclusions).toEqual(["bluetooth only"]);
    expect(merged.decisionStyle).toBe("best value");
    expect(merged.productType).toBe("mechanical keyboard");
    expect(baseBrief.exclusions).toEqual([]); // input brief untouched
  });
});

describe("shoppingBriefToText and briefSignature", () => {
  it("serializes the brief for the server prompt", () => {
    const text = shoppingBriefToText({ ...baseBrief, budget: { amount: 120, currency: "USD" }, deliveryCountry: "NG" });
    expect(text).toContain("product_type: mechanical keyboard");
    expect(text).toContain("budget: 120 USD");
    expect(text).toContain("derived_country: NG");
  });

  it("changes the signature when any brief field changes", () => {
    const withBudget = { ...baseBrief, budget: { amount: 120, currency: "USD" } };
    expect(briefSignature(baseBrief)).not.toBe(briefSignature(withBudget));
    expect(briefSignature(withBudget)).not.toBe(briefSignature({ ...withBudget, budget: { amount: 121, currency: "USD" } }));
    expect(briefSignature(baseBrief)).toBe(briefSignature(structuredClone(baseBrief)));
  });
});
