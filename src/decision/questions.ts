import type { DecisionAnswers, DecisionDomain } from "../types.js";
import { DEMO_DELIVERY_ADDRESS } from "./country.js";

export interface DecisionOption {
  value: string;
  label: string;
  hint?: string;
}

export interface DecisionQuestion {
  id: string;
  eyebrow: string;
  prompt: string;
  detail: string;
  multiple?: boolean;
  /** "text" renders a free-text input instead of option chips. */
  kind?: "options" | "text";
  defaultValue?: string;
  placeholder?: string;
  options: DecisionOption[];
}

const sharedDecisionStyle: DecisionQuestion = {
  id: "decision_style",
  eyebrow: "Choosing",
  prompt: "How should the agent choose for you?",
  detail: "The agent weighs this when picking finalists from live listings.",
  options: [
    { value: "crowd favourite", label: "Crowd favourite", hint: "Widely chosen, well-known picks" },
    { value: "best value", label: "Best value for money" },
    { value: "hidden gem", label: "Cheap but a hidden gem", hint: "Lesser-known, strong for the price" },
    { value: "industry standard", label: "The industry standard", hint: "The safe, default choice" },
  ],
};

const sharedStorePreference: DecisionQuestion = {
  id: "store_preference",
  eyebrow: "Stores",
  prompt: "Any preference on where it comes from?",
  detail: "The agent weighs merchant signals from live Shopify listings.",
  options: [
    { value: "no preference", label: "No preference" },
    { value: "big-name stores", label: "Big-name stores" },
    { value: "smaller independent stores", label: "Smaller independent stores" },
  ],
};

const sharedDelivery: DecisionQuestion = {
  id: "delivery_address",
  eyebrow: "Delivery",
  prompt: "Where should it arrive?",
  detail: "A demo address is prefilled — keep it or type your own. The agent derives your country from it for live Shopify availability.",
  kind: "text",
  defaultValue: DEMO_DELIVERY_ADDRESS,
  placeholder: DEMO_DELIVERY_ADDRESS,
  options: [],
};

export const DECISION_QUESTIONS: Record<DecisionDomain, DecisionQuestion[]> = {
  meals: [
    {
      id: "meal_type",
      eyebrow: "The meal",
      prompt: "What would make eating easier for you right now?",
      detail: "Choose the closest need and I’ll shape the search around it.",
      options: [
        { value: "quick dinner", label: "Quick dinner", hint: "Minimal preparation" },
        { value: "healthy snacks", label: "Healthy snacks" },
        { value: "breakfast", label: "Breakfast" },
        { value: "meal kit", label: "Meal kit" },
      ],
    },
    sharedDecisionStyle,
    sharedStorePreference,
    {
      id: "food_priority",
      eyebrow: "Priorities",
      prompt: "What would make this feel like the right choice for you?",
      detail: "Pick up to two priorities and I’ll explain the tradeoffs around them.",
      multiple: true,
      options: [
        { value: "high protein", label: "High protein" },
        { value: "low calorie", label: "Lighter" },
        { value: "plant based", label: "Plant based" },
        { value: "best value", label: "Best value" },
      ],
    },
    {
      id: "budget",
      eyebrow: "Budget",
      prompt: "What is the comfortable ceiling?",
      detail: "The agent uses this as a hard filter where possible.",
      options: [
        { value: "25", label: "Under $25" },
        { value: "50", label: "Under $50" },
        { value: "100", label: "Under $100" },
        { value: "flexible", label: "Flexible" },
      ],
    },
    sharedDelivery,
  ],
  gadgets: [
    {
      id: "gadget_type",
      eyebrow: "The device",
      prompt: "What are you hoping this device will help you do?",
      detail: "Choose the closest product and I’ll focus the live search for you.",
      options: [
        { value: "wireless headphones", label: "Headphones" },
        { value: "portable speaker", label: "Speaker" },
        { value: "smartwatch", label: "Smartwatch" },
        { value: "phone accessory", label: "Phone accessory" },
      ],
    },
    sharedDecisionStyle,
    sharedStorePreference,
    {
      id: "gadget_priority",
      eyebrow: "Priorities",
      prompt: "Which qualities would make you happiest with the choice?",
      detail: "Pick up to two and I’ll make the tradeoffs easy to compare.",
      multiple: true,
      options: [
        { value: "long battery life", label: "Battery life" },
        { value: "premium sound quality", label: "Sound quality" },
        { value: "lightweight", label: "Low weight" },
        { value: "best value", label: "Best value" },
      ],
    },
    {
      id: "budget",
      eyebrow: "Budget",
      prompt: "Where should the agent draw the line?",
      detail: "Live prices are checked against this ceiling.",
      options: [
        { value: "50", label: "Under $50" },
        { value: "100", label: "Under $100" },
        { value: "200", label: "Under $200" },
        { value: "flexible", label: "Flexible" },
      ],
    },
    sharedDelivery,
  ],
  clothing: [
    {
      id: "clothing_type",
      eyebrow: "The piece",
      prompt: "What would you like to feel confident wearing?",
      detail: "Choose a starting point and I’ll look for options that fit the occasion.",
      options: [
        { value: "complete outfit", label: "Complete outfit" },
        { value: "dress", label: "Dress" },
        { value: "jacket", label: "Jacket" },
        { value: "shoes", label: "Shoes" },
      ],
    },
    sharedDecisionStyle,
    sharedStorePreference,
    {
      id: "style_priority",
      eyebrow: "Style",
      prompt: "How would you like the final choice to feel on you?",
      detail: "Pick up to two style signals so the shortlist feels more like you.",
      multiple: true,
      options: [
        { value: "minimal", label: "Minimal" },
        { value: "formal", label: "Formal" },
        { value: "casual", label: "Casual" },
        { value: "breathable", label: "Breathable" },
      ],
    },
    {
      id: "budget",
      eyebrow: "Budget",
      prompt: "What is the comfortable ceiling?",
      detail: "The agent filters live listed prices against it.",
      options: [
        { value: "75", label: "Under $75" },
        { value: "150", label: "Under $150" },
        { value: "300", label: "Under $300" },
        { value: "flexible", label: "Flexible" },
      ],
    },
    sharedDelivery,
  ],
};

export function answersToPrompt(domain: DecisionDomain, answers: Record<string, string[]>) {
  const questions = DECISION_QUESTIONS[domain];
  return questions
    .filter((question) => question.id !== "delivery_address")
    .map((question) => `${question.prompt} ${answers[question.id]?.join(", ") || "not specified"}`)
    .join("\n");
}

export const requiredQuestionIds = (domain: DecisionDomain) =>
  DECISION_QUESTIONS[domain].map((question) => question.id);

export function isValidAnswerValues(question: DecisionQuestion, values: string[]): boolean {
  if (values.length < 1 || values.length > (question.multiple ? 2 : 1)) return false;
  if (new Set(values).size !== values.length) return false;
  if (question.kind === "text") return values.every((value) => value.trim().length >= 3 && value.trim().length <= 200);
  return values.every((value) => question.options.some((option) => option.value === value));
}

export function validateDecisionAnswers(domain: DecisionDomain, value: unknown): DecisionAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const questions = DECISION_QUESTIONS[domain];
  const expectedIds = new Set(questions.map((question) => question.id));
  if (Object.keys(input).length !== questions.length || Object.keys(input).some((id) => !expectedIds.has(id))) return null;

  const answers: DecisionAnswers = {};
  for (const question of questions) {
    const raw = input[question.id];
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > (question.multiple ? 2 : 1)) return null;
    if (!raw.every((item): item is string => typeof item === "string")) return null;
    const values = raw.map((item) => item.trim());
    if (new Set(values).size !== values.length) return null;
    if (question.kind === "text") {
      if (!values.every((item) => item.length >= 3 && item.length <= 200)) return null;
    } else if (!values.every((item) => question.options.some((option) => option.value === item))) return null;
    answers[question.id] = values;
  }
  return answers;
}
