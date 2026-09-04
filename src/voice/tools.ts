import { DECISION_QUESTIONS, isValidAnswerValues, requiredQuestionIds } from "../decision/questions";
import { isValidClarifyingAnswer } from "../decision/shoppingBrief";
import { DOMAIN_CONFIG } from "../data/catalog";
import { startCurrentLiveSearch } from "../agent/startCurrentSearch";
import { startGeneralLiveSearch, startTextDiscovery } from "../agent/startDiscovery";
import { useStore } from "../store/useStore";
import type { DecisionDomain } from "../types";

type VoiceToolArguments = Record<string, unknown>;

const domains: Array<Exclude<DecisionDomain, "general">> = ["meals", "gadgets", "clothing"];

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}

function exactConfirmation(args: VoiceToolArguments, phrase: string) {
  if (args.confirmation !== phrase) throw new Error(`This action requires the exact spoken confirmation: ${phrase}.`);
}

export function getAccessibleSnapshot() {
  const state = useStore.getState();
  if (!state.domain) {
    return {
      screen: "open product search",
      instruction: "Ask the shopper: what are you looking for? Any product description works. Example guided journeys are also available.",
      open_request: true,
      examples: domains.map((domain, index) => ({ number: index + 1, value: domain, label: DOMAIN_CONFIG[domain].label })),
      interpretation_error: state.interpretationError ?? undefined,
    };
  }

  if (state.domain === "general") {
    const clarifying = state.clarifyingQuestions.map((question, index) => ({
      number: index + 1,
      id: question.id,
      prompt: question.prompt,
      detail: question.detail,
      kind: question.kind,
      required: question.required,
      answered: isValidClarifyingAnswer(question, state.answers[question.id] ?? []),
      choices: question.options?.map((option, optionIndex) => ({ number: optionIndex + 1, value: option.value, label: option.label })),
    }));
    return {
      screen: state.stage,
      category: "open product search",
      interpreting: state.stage === "interpreting" ? "The agent is interpreting the request; wait for the next screen." : undefined,
      interpretation: state.discoveryReference ?? undefined,
      uncertainty_notes: state.discoveryReference?.uncertaintyNotes,
      current_question: state.stage === "clarifying" ? clarifying.find((question) => question.required && !question.answered) ?? clarifying.find((question) => !question.answered) ?? null : undefined,
      all_questions: state.stage === "clarifying" ? clarifying : undefined,
      shopping_brief: state.stage === "brief-review" || state.stage === "searching" || state.stage === "error" ? state.shoppingBrief : undefined,
      brief_confirmed: state.briefConfirmed,
      search_status: state.stage === "searching" ? state.searchEvents.at(-1) : undefined,
      search_error: state.stage === "error" ? state.searchError : undefined,
      results: state.stage === "results" ? state.liveProducts.map((product, index) => ({
        number: index + 1,
        product_id: product.id,
        name: product.name,
        merchant: product.merchant,
        price: product.price,
        currency: product.currency,
        recommendation: product.recommendation,
        tradeoffs: product.tradeoffs,
      })) : undefined,
      result_summary: state.stage === "results" ? state.searchSummary : undefined,
      confirmed_cart: state.cart.map((line) => {
        const product = state.liveProducts.find((item) => item.id === line.productId);
        return { product_id: line.productId, name: product?.name ?? line.productId, quantity: line.qty };
      }),
      pending_proposals: state.proposals.map((proposal) => ({
        id: proposal.id,
        kind: proposal.kind,
        quantity: proposal.qty,
        reason: proposal.reason,
        product_id: proposal.productId ?? proposal.addProductId ?? proposal.removeProductId,
      })),
      plan_confirmed: Boolean(state.checkedOut),
    };
  }

  const questions = DECISION_QUESTIONS[state.domain];
  const decisions = questions.map((question, index) => ({
    number: index + 1,
    id: question.id,
    prompt: question.prompt,
    detail: question.detail,
    choose_up_to: question.multiple ? 2 : 1,
    free_text: question.kind === "text",
    selected_values: state.answers[question.id] ?? [],
    choices: question.options.map((option, optionIndex) => ({ number: optionIndex + 1, value: option.value, label: option.label, hint: option.hint })),
  }));
  const currentDecision = decisions.find((question) => question.selected_values.length === 0) ?? null;

  return {
    screen: state.stage,
    category: state.domain,
    current_decision: state.stage === "decisions" ? currentDecision : null,
    all_decisions: state.stage === "decisions" ? decisions : undefined,
    search_status: state.stage === "searching" ? state.searchEvents.at(-1) : undefined,
    search_error: state.stage === "error" ? state.searchError : undefined,
    results: state.stage === "results" ? state.liveProducts.map((product, index) => ({
      number: index + 1,
      product_id: product.id,
      name: product.name,
      merchant: product.merchant,
      price: product.price,
      currency: product.currency,
      recommendation: product.recommendation,
      tradeoffs: product.tradeoffs,
    })) : undefined,
    result_summary: state.stage === "results" ? state.searchSummary : undefined,
    confirmed_cart: state.cart.map((line) => {
      const product = state.liveProducts.find((item) => item.id === line.productId);
      return { product_id: line.productId, name: product?.name ?? line.productId, quantity: line.qty };
    }),
    pending_proposals: state.proposals.map((proposal) => ({
      id: proposal.id,
      kind: proposal.kind,
      quantity: proposal.qty,
      reason: proposal.reason,
      product_id: proposal.productId ?? proposal.addProductId ?? proposal.removeProductId,
    })),
    plan_confirmed: Boolean(state.checkedOut),
  };
}

export async function executeVoiceTool(name: string, args: VoiceToolArguments) {
  const state = useStore.getState();
  switch (name) {
    case "read_current_screen":
      return { ok: true, state: getAccessibleSnapshot() };
    case "set_shopping_request": {
      if (state.domain) throw new Error("A shopping session is already active. Read the current screen first.");
      const request = text(args.request, "request");
      const payload = await startTextDiscovery(request);
      const uncertainty = payload.reference.uncertaintyNotes.length ? ` I am not certain about: ${payload.reference.uncertaintyNotes.join("; ")}.` : "";
      return {
        ok: true,
        message: `I understood: ${payload.reference.interpretedProduct}.${uncertainty}`,
        questions_to_ask: payload.questions.map((question) => question.prompt),
        state: getAccessibleSnapshot(),
      };
    }
    case "answer_clarifying_question": {
      if (state.domain !== "general" || state.stage !== "clarifying") throw new Error("Clarifying questions are only available during an open search clarification.");
      const questionId = text(args.question_id, "question_id");
      const question = state.clarifyingQuestions.find((item) => item.id === questionId);
      if (!question) throw new Error(`The question ${questionId} is not currently visible.`);
      if (!Array.isArray(args.values) || args.values.some((value) => typeof value !== "string")) throw new Error("values must be a list of strings.");
      const values = args.values.map((value) => (value as string).trim());
      if (!isValidClarifyingAnswer(question, values)) throw new Error("That answer does not match the choices offered for this question.");
      state.setClarifyingAnswer(questionId, values, "agent");
      return { ok: true, message: `Recorded ${values.join(" and ")}.`, state: getAccessibleSnapshot() };
    }
    case "confirm_shopping_brief": {
      exactConfirmation(args, "confirm brief and search");
      if (state.domain !== "general") throw new Error("There is no open shopping brief to confirm.");
      if (state.stage === "clarifying") {
        const missing = state.clarifyingQuestions.filter((question) => question.required && !isValidClarifyingAnswer(question, state.answers[question.id] ?? []));
        if (missing.length) throw new Error(`${missing.length} required question(s) still need an answer.`);
        state.proceedToBriefReview();
      }
      if (!useStore.getState().confirmShoppingBrief()) throw new Error("The brief must be reviewed before it can be confirmed.");
      const result = await startGeneralLiveSearch();
      return { ok: true, message: `Brief confirmed. Found ${result.products.length} live Shopify results.`, state: getAccessibleSnapshot() };
    }
    case "choose_domain": {
      const domain = text(args.domain, "domain") as Exclude<DecisionDomain, "general">;
      if (!domains.includes(domain)) throw new Error("Choose meals, gadgets, or clothing.");
      state.startDomain(domain, false);
      return { ok: true, message: `${DOMAIN_CONFIG[domain].label} selected.`, state: getAccessibleSnapshot() };
    }
    case "answer_current_question": {
      if (!state.domain || state.stage !== "decisions") throw new Error("Decision answers can only be changed on the decision screen.");
      const questionId = text(args.question_id, "question_id");
      const question = DECISION_QUESTIONS[state.domain].find((item) => item.id === questionId);
      if (!question) throw new Error(`The question ${questionId} is not available in this category.`);
      if (!Array.isArray(args.values) || args.values.some((value) => typeof value !== "string")) throw new Error("values must be a list of offered choice values.");
      const values = args.values.map((value) => (value as string).trim());
      const max = question.multiple ? 2 : 1;
      if (!isValidAnswerValues(question, values)) throw new Error(question.kind === "text" ? "Provide one short free-text value for this question." : `Choose between 1 and ${max} unique option(s), using only values offered for this question.`);
      state.setDecisionAnswer(questionId, values, "agent");
      return { ok: true, message: `Recorded ${values.join(" and ")}.`, state: getAccessibleSnapshot() };
    }
    case "start_live_search": {
      if (!state.domain) throw new Error("Tell me what you are looking for first.");
      if (state.domain === "general") {
        if (state.stage !== "brief-review" || !state.briefConfirmed) throw new Error("Confirm the shopping brief with the exact phrase before searching.");
        const result = await startGeneralLiveSearch();
        return { ok: true, message: `Found ${result.products.length} live Shopify results.`, state: getAccessibleSnapshot() };
      }
      if (state.stage !== "decisions") throw new Error("Live search can only start after the decision screen is complete.");
      const missing = requiredQuestionIds(state.domain).filter((id) => !state.answers[id]?.length);
      if (missing.length) throw new Error(`${missing.length} required decision(s) still need an answer.`);
      const result = await startCurrentLiveSearch();
      return { ok: true, message: `Found ${result.products.length} live Shopify results.`, state: getAccessibleSnapshot() };
    }
    case "read_results":
      if (state.stage !== "results") throw new Error("Live results are not currently available.");
      return { ok: true, state: getAccessibleSnapshot() };
    case "propose_add_to_cart": {
      if (state.stage !== "results") throw new Error("Products can only be proposed from current live results.");
      const productId = text(args.product_id, "product_id");
      const quantity = args.quantity;
      if (!Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 99) throw new Error("quantity must be a whole number from 1 to 99.");
      const reason = text(args.reason, "reason");
      const result = state.addToCart(productId, quantity as number, "agent", reason);
      if (!result.ok) throw new Error(result.message);
      return { ok: true, message: result.message, state: getAccessibleSnapshot() };
    }
    case "read_cart":
      return { ok: true, state: getAccessibleSnapshot() };
    case "approve_all_proposals": {
      exactConfirmation(args, "approve all changes");
      const count = state.approveAll();
      if (!count) throw new Error("There are no pending proposals to approve.");
      return { ok: true, message: `Approved ${count} pending change(s).`, state: getAccessibleSnapshot() };
    }
    case "reject_all_proposals": {
      exactConfirmation(args, "reject all changes");
      const count = state.rejectAll();
      if (!count) throw new Error("There are no pending proposals to reject.");
      return { ok: true, message: `Rejected ${count} pending change(s).`, state: getAccessibleSnapshot() };
    }
    case "confirm_shopping_plan": {
      exactConfirmation(args, "confirm shopping plan");
      const result = state.checkout("agent");
      if (!result.ok) throw new Error(result.message);
      return { ok: true, message: result.message, state: getAccessibleSnapshot() };
    }
    case "go_back_to_decisions": {
      exactConfirmation(args, "go back and clear results");
      state.returnToDecisions();
      return { ok: true, message: "Went back and cleared the live results and cart work.", state: getAccessibleSnapshot() };
    }
    default:
      throw new Error(`Unsupported hands-free tool: ${name}.`);
  }
}
