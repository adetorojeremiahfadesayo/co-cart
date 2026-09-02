import type { DecisionAnswers, DecisionDomain } from "../types.js";

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
  options: DecisionOption[];
}

const sharedDelivery: DecisionQuestion = {
  id: "ships_to",
  eyebrow: "Delivery",
  prompt: "Where should it arrive?",
  detail: "This becomes a live availability signal for Shopify Catalog.",
  options: [
    { value: "NG", label: "Nigeria", hint: "Show offers available to Nigeria" },
    { value: "US", label: "United States" },
    { value: "GB", label: "United Kingdom" },
    { value: "CA", label: "Canada" },
  ],
};

export const DECISION_QUESTIONS: Record<DecisionDomain, DecisionQuestion[]> = {
  meals: [
    {
      id: "meal_type",
      eyebrow: "The meal",
      prompt: "What are we looking for?",
      detail: "Choose the closest intent. You can revise it after selecting.",
      options: [
        { value: "quick dinner", label: "Quick dinner", hint: "Minimal preparation" },
        { value: "healthy snacks", label: "Healthy snacks" },
        { value: "breakfast", label: "Breakfast" },
        { value: "meal kit", label: "Meal kit" },
      ],
    },
    {
      id: "food_priority",
      eyebrow: "Priorities",
      prompt: "What matters most?",
      detail: "Pick up to two signals for the agent to weigh.",
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
      prompt: "What are you shopping for?",
      detail: "A focused category gives the live agent a better starting point.",
      options: [
        { value: "wireless headphones", label: "Headphones" },
        { value: "portable speaker", label: "Speaker" },
        { value: "smartwatch", label: "Smartwatch" },
        { value: "phone accessory", label: "Phone accessory" },
      ],
    },
    {
      id: "gadget_priority",
      eyebrow: "Priorities",
      prompt: "What should win the comparison?",
      detail: "Pick up to two. The agent will explain any tradeoff.",
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
      prompt: "What are we finding?",
      detail: "Choose a useful starting point for the live catalog search.",
      options: [
        { value: "complete outfit", label: "Complete outfit" },
        { value: "dress", label: "Dress" },
        { value: "jacket", label: "Jacket" },
        { value: "shoes", label: "Shoes" },
      ],
    },
    {
      id: "style_priority",
      eyebrow: "Style",
      prompt: "What should the result feel like?",
      detail: "Pick up to two style signals.",
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
    .filter((question) => question.id !== "ships_to")
    .map((question) => `${question.prompt} ${answers[question.id]?.join(", ") || "not specified"}`)
    .join("\n");
}

export const requiredQuestionIds = (domain: DecisionDomain) =>
  DECISION_QUESTIONS[domain].map((question) => question.id);

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
    if (!values.every((item) => question.options.some((option) => option.value === item))) return null;
    answers[question.id] = values;
  }
  return answers;
}
