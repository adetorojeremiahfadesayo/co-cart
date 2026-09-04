import type {
  ClarifyingField,
  ClarifyingQuestion,
  DiscoveryMode,
  DiscoveryReference,
  ShoppingBrief,
} from "../types.js";

export const REQUEST_MIN_LENGTH = 3;
export const REQUEST_MAX_LENGTH = 500;
export const MAX_CLARIFYING_QUESTIONS = 5;
export const MAX_QUESTION_OPTIONS = 6;
export const MAX_LIST_ITEMS = 8;

export const DECISION_STYLES = ["crowd favourite", "best value", "hidden gem", "industry standard"] as const;
export const STORE_PREFERENCES = ["no preference", "big-name stores", "smaller independent stores"] as const;
export const DELIVERY_COUNTRIES = ["NG", "US", "GB", "CA"] as const;

export const CLARIFYING_FIELDS: ClarifyingField[] = [
  "productType",
  "useCase",
  "priorities",
  "exclusions",
  "decisionStyle",
  "storePreference",
  "budget",
  "deliveryCountry",
];

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const cleanText = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max ? value.trim() : null;

const cleanTextList = (value: unknown, maxItems: number, maxLength: number): string[] | null => {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length >= 1 && item.length <= maxLength);
  return items.length <= maxItems ? [...new Set(items)] : null;
};

export function validateDiscoveryText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= REQUEST_MIN_LENGTH && text.length <= REQUEST_MAX_LENGTH ? text : null;
}

export function validateDiscoveryReference(value: unknown): DiscoveryReference | null {
  const object = asObject(value);
  if (!object) return null;
  const mode = object.mode;
  if (mode !== "text" && mode !== "image" && mode !== "url" && mode !== "example") return null;
  const interpretedProduct = cleanText(object.interpretedProduct, 160);
  if (!interpretedProduct) return null;
  const visibleAttributes = cleanTextList(object.visibleAttributes ?? [], MAX_LIST_ITEMS, 80);
  const uncertaintyNotes = cleanTextList(object.uncertaintyNotes ?? [], MAX_LIST_ITEMS, 160);
  if (!visibleAttributes || !uncertaintyNotes) return null;
  const reference: DiscoveryReference = { mode: mode as DiscoveryMode, interpretedProduct, visibleAttributes, uncertaintyNotes };
  const originalText = cleanText(object.originalText, REQUEST_MAX_LENGTH);
  if (originalText) reference.originalText = originalText;
  if (typeof object.sourceUrl === "string" && /^https:\/\/\S+$/.test(object.sourceUrl) && object.sourceUrl.length <= 2048) {
    reference.sourceUrl = object.sourceUrl;
  }
  return reference;
}

export function validateShoppingBrief(value: unknown): ShoppingBrief | null {
  const object = asObject(value);
  if (!object) return null;
  const productType = cleanText(object.productType, 120);
  if (!productType || productType.length < 2) return null;
  const priorities = cleanTextList(object.priorities ?? [], MAX_LIST_ITEMS, 80);
  const exclusions = cleanTextList(object.exclusions ?? [], MAX_LIST_ITEMS, 80);
  if (!priorities || !exclusions) return null;
  const brief: ShoppingBrief = { productType, priorities, exclusions };

  const useCase = cleanText(object.useCase, 200);
  if (useCase) brief.useCase = useCase;
  if (DECISION_STYLES.includes(object.decisionStyle as typeof DECISION_STYLES[number])) {
    brief.decisionStyle = object.decisionStyle as string;
  }
  if (STORE_PREFERENCES.includes(object.storePreference as typeof STORE_PREFERENCES[number])) {
    brief.storePreference = object.storePreference as string;
  }
  if (object.budget != null) {
    const budget = asObject(object.budget);
    const amount = Number(budget?.amount);
    const currency = typeof budget?.currency === "string" ? budget.currency.toUpperCase() : "";
    if (!budget || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !/^[A-Z]{3}$/.test(currency)) return null;
    brief.budget = { amount: Math.round(amount * 100) / 100, currency };
  }
  if (object.deliveryCountry != null) {
    if (!DELIVERY_COUNTRIES.includes(object.deliveryCountry as typeof DELIVERY_COUNTRIES[number])) return null;
    brief.deliveryCountry = object.deliveryCountry as string;
  }
  if (object.reference != null) {
    const reference = validateDiscoveryReference(object.reference);
    if (!reference) return null;
    brief.reference = reference;
  }
  return brief;
}

const QUESTION_KINDS: ClarifyingQuestion["kind"][] = ["single", "multiple", "text", "money"];

// Server-side validation of model-generated clarification. Structurally
// invalid questions are dropped; the remaining set is capped and unique.
export function normalizeClarifyingQuestions(value: unknown): ClarifyingQuestion[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const questions: ClarifyingQuestion[] = [];
  for (const raw of value) {
    if (questions.length >= MAX_CLARIFYING_QUESTIONS) break;
    const object = asObject(raw);
    if (!object) continue;
    const id = cleanText(object.id, 40);
    const prompt = cleanText(object.prompt, 200);
    const kind = object.kind;
    const field = object.field;
    if (!id || !/^[a-z0-9_-]+$/.test(id) || seen.has(id) || !prompt) continue;
    if (!QUESTION_KINDS.includes(kind as ClarifyingQuestion["kind"])) continue;
    if (!CLARIFYING_FIELDS.includes(field as ClarifyingField)) continue;
    const question: ClarifyingQuestion = {
      id,
      prompt,
      kind: kind as ClarifyingQuestion["kind"],
      field: field as ClarifyingField,
      required: object.required === true,
    };
    const detail = cleanText(object.detail, 240);
    if (detail) question.detail = detail;
    if (question.kind === "single" || question.kind === "multiple") {
      if (!Array.isArray(object.options)) continue;
      const options = object.options
        .map(asObject)
        .filter((option): option is Record<string, unknown> => Boolean(option))
        .map((option) => ({ value: cleanText(option.value, 60), label: cleanText(option.label, 80) }))
        .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label));
      const unique = [...new Map(options.map((option) => [option.value, option])).values()];
      if (unique.length < 2 || unique.length > MAX_QUESTION_OPTIONS) continue;
      question.options = unique;
    }
    seen.add(id);
    questions.push(question);
  }
  return questions;
}

export function isValidClarifyingAnswer(question: ClarifyingQuestion, values: string[]): boolean {
  if (!values.length || new Set(values).size !== values.length) return false;
  if (values.some((value) => typeof value !== "string" || !value.trim())) return false;
  switch (question.kind) {
    case "single":
      return values.length === 1 && Boolean(question.options?.some((option) => option.value === values[0]));
    case "multiple":
      return values.length <= 2 && values.every((value) => question.options?.some((option) => option.value === value));
    case "text":
      return values.length === 1 && values[0].trim().length >= 2 && values[0].trim().length <= 200;
    case "money": {
      if (values.length !== 1) return false;
      const amount = Number(values[0]);
      return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000;
    }
  }
}

// Fold confirmed clarification answers into the brief the shopper reviews.
export function applyClarifyingAnswers(
  brief: ShoppingBrief,
  questions: ClarifyingQuestion[],
  answers: Record<string, string[]>,
): ShoppingBrief {
  const next: ShoppingBrief = structuredClone(brief);
  for (const question of questions) {
    const values = (answers[question.id] ?? []).map((value) => value.trim()).filter(Boolean);
    if (!values.length) continue;
    switch (question.field) {
      case "productType":
        next.productType = values[0].slice(0, 120);
        break;
      case "useCase":
        next.useCase = values.join("; ").slice(0, 200);
        break;
      case "priorities":
        next.priorities = [...new Set([...next.priorities, ...values])].slice(0, MAX_LIST_ITEMS);
        break;
      case "exclusions":
        next.exclusions = [...new Set([...next.exclusions, ...values])].slice(0, MAX_LIST_ITEMS);
        break;
      case "decisionStyle":
        if (DECISION_STYLES.includes(values[0] as typeof DECISION_STYLES[number])) next.decisionStyle = values[0];
        break;
      case "storePreference":
        if (STORE_PREFERENCES.includes(values[0] as typeof STORE_PREFERENCES[number])) next.storePreference = values[0];
        break;
      case "budget": {
        const amount = Number(values[0]);
        if (Number.isFinite(amount) && amount > 0) {
          next.budget = { amount: Math.round(amount * 100) / 100, currency: next.budget?.currency ?? "USD" };
        }
        break;
      }
      case "deliveryCountry": {
        const country = values[0].toUpperCase();
        if (DELIVERY_COUNTRIES.includes(country as typeof DELIVERY_COUNTRIES[number])) next.deliveryCountry = country;
        break;
      }
    }
  }
  return next;
}

export function shoppingBriefToText(brief: ShoppingBrief): string {
  const lines = [`product_type: ${brief.productType}`];
  if (brief.useCase) lines.push(`use_case: ${brief.useCase}`);
  if (brief.priorities.length) lines.push(`priorities: ${brief.priorities.join(", ")}`);
  if (brief.exclusions.length) lines.push(`exclusions: ${brief.exclusions.join(", ")}`);
  if (brief.decisionStyle) lines.push(`decision_style: ${brief.decisionStyle}`);
  if (brief.storePreference) lines.push(`store_preference: ${brief.storePreference}`);
  if (brief.budget) lines.push(`budget: ${brief.budget.amount} ${brief.budget.currency}`);
  if (brief.deliveryCountry) lines.push(`derived_country: ${brief.deliveryCountry}`);
  const reference = brief.reference;
  if (reference) {
    lines.push(`reference_mode: ${reference.mode}`);
    lines.push(`interpreted_product: ${reference.interpretedProduct}`);
    if (reference.visibleAttributes.length) lines.push(`visible_attributes: ${reference.visibleAttributes.join(", ")}`);
    if (reference.uncertaintyNotes.length) lines.push(`uncertainty_notes: ${reference.uncertaintyNotes.join(", ")}`);
  }
  return lines.join("\n");
}

// Canonical signature used to prove a general brief never collides with a
// cached demo snapshot: any changed field produces a different signature.
export function briefSignature(brief: ShoppingBrief): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
    }
    return value;
  };
  return JSON.stringify(stable(brief));
}
