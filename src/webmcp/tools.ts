import { cancelActiveSearch, runCoordinatedSearch } from "../agent/searchCoordinator";
import { DECISION_QUESTIONS, requiredQuestionIds } from "../decision/questions";
import { checkConstraints, liveProductById, projectedCart, useStore } from "../store/useStore";
import { formatCurrencyTotals, formatMoney } from "../utils/money";
import type { DecisionDomain, Preferences } from "../types";

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };
const text = (payload: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });
const err = (message: string): ToolResult => ({ content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true });

function getModelContext(): any | null {
  const nav = typeof navigator === "undefined" ? null : navigator as any;
  const doc = typeof document === "undefined" ? null : document as any;
  return nav?.modelContext ?? doc?.modelContext ?? null;
}

const productSummary = (id: string) => {
  const product = liveProductById(id);
  if (!product) return null;
  return {
    ...product,
    source: product.demoOnly ? "seeded demo" : "live Shopify Global Catalog",
    priceClaim: `${formatMoney(product.price, product.currency)} listed by ${product.merchant}; shipping and tax may be additional`,
  };
};

function cartPayload() {
  const state = useStore.getState();
  const totals = state.cartTotals();
  return {
    confirmedCart: state.cart.map((item) => ({ ...item, product: productSummary(item.productId) })),
    proposals: state.proposals.map((proposal) => ({
      ...proposal,
      product: proposal.productId ? productSummary(proposal.productId) : undefined,
      from: proposal.removeProductId ? productSummary(proposal.removeProductId) : undefined,
      to: proposal.addProductId ? productSummary(proposal.addProductId) : undefined,
    })),
    totals: {
      confirmedListedSubtotals: totals.currencyTotals,
      projectedListedSubtotalsIfApproved: totals.proposedCurrencyTotals,
      confirmedDisplay: formatCurrencyTotals(totals.currencyTotals),
      projectedDisplay: formatCurrencyTotals(totals.proposedCurrencyTotals),
      itemCount: totals.itemCount,
      pendingApprovalCount: totals.pendingCount,
      excludes: ["shipping", "tax"],
    },
    approvalGate: totals.pendingCount ? "Human approval required" : "No pending proposals",
  };
}

async function audited(name: string, _args: unknown, run: () => Promise<ToolResult> | ToolResult) {
  try {
    const output = await run();
    useStore.getState().log("agent", `${name} ${output.isError ? "failed" : "completed"}`, name, output.isError ? "error" : "success");
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useStore.getState().log("agent", `${name} failed · ${message}`, name, "error");
    return err(`${name} failed: ${message}`);
  }
}

const requireDomain = () => useStore.getState().domain ?? null;
const validDomain = (value: unknown): value is DecisionDomain => value === "meals" || value === "gadgets" || value === "clothing";

let registered = false;
let registration: Promise<boolean> | null = null;
const registeredToolNames = new Set<string>();

const tools = [
    {
      name: "get-decision-state",
      description: "Read the visible Co-Cart workflow: category, stage, decision questions and answers, live Shopify results, confirmed cart, and pending human approvals.",
      inputSchema: { type: "object", properties: {} },
      execute: async (args: unknown) => audited("get-decision-state", args, () => {
        const state = useStore.getState();
        return text({
          domain: state.domain,
          stage: state.stage,
          questions: state.domain ? DECISION_QUESTIONS[state.domain] : [],
          answers: state.answers,
          search: { source: "OpenAI agent → Shopify Global Catalog MCP", status: state.stage, events: state.searchEvents, error: state.searchError },
          liveResults: state.liveProducts.map((product) => productSummary(product.id)),
          ...cartPayload(),
        });
      }),
    },
    {
      name: "select-domain",
      description: "Select one visible shopping category and open its decision-card workflow. This clears the prior workspace.",
      inputSchema: { type: "object", properties: { domain: { type: "string", enum: ["meals", "gadgets", "clothing"] } }, required: ["domain"] },
      execute: async (args: { domain?: unknown }) => audited("select-domain", args, () => {
        if (!validDomain(args.domain)) return err("domain must be meals, gadgets, or clothing.");
        cancelActiveSearch();
        useStore.getState().startDomain(args.domain, false);
        return text({ message: `Selected ${args.domain}. The visible decision cards are ready.`, questions: DECISION_QUESTIONS[args.domain] });
      }),
    },
    {
      name: "set-decision-answer",
      description: "Answer one visible decision card. Use option values from get-decision-state; multiple-choice questions accept at most two values.",
      inputSchema: { type: "object", properties: { questionId: { type: "string" }, values: { type: "array", items: { type: "string" }, maxItems: 2 } }, required: ["questionId", "values"] },
      execute: async (args: { questionId?: unknown; values?: unknown }) => audited("set-decision-answer", args, () => {
        const domain = requireDomain();
        if (!domain) return err("Choose a category first.");
        const question = DECISION_QUESTIONS[domain].find((item) => item.id === args.questionId);
        if (!question || !Array.isArray(args.values)) return err("Unknown decision question or invalid values.");
        const values = args.values.filter((value): value is string => typeof value === "string");
        const valid = values.length > 0 && values.length <= (question.multiple ? 2 : 1) && values.every((value) => question.options.some((option) => option.value === value));
        if (!valid) return err(`Use ${question.multiple ? "one or two" : "one"} valid option value(s) for ${question.id}.`);
        useStore.getState().setDecisionAnswer(question.id, values, "agent");
        return text({ message: "Decision updated in the visible UI.", questionId: question.id, values });
      }),
    },
    {
      name: "start-live-search",
      description: "Start the real OpenAI shopping agent. It searches Shopify Global Catalog through MCP and streams progress into the visible UI. It never falls back to demo data.",
      inputSchema: { type: "object", properties: {} },
      execute: async (args: unknown) => audited("start-live-search", args, async () => {
        const state = useStore.getState();
        const domain = state.domain;
        if (!domain) return err("Choose a category first.");
        if (state.stage === "searching") return err("A live search is already running.");
        const missing = requiredQuestionIds(domain).filter((id) => !state.answers[id]?.length);
        if (missing.length) return err(`Answer every visible decision card first. Missing: ${missing.join(", ")}.`);
        const searchId = state.beginLiveSearch();
        if (!searchId) return err("A live search is already running.");
        try {
          const result = await runCoordinatedSearch(domain, structuredClone(state.answers), { onStatus: (label, detail, status) => useStore.getState().addSearchEvent(searchId, label, detail, status) });
          if (!useStore.getState().completeLiveSearch(searchId, result.products, result.summary)) return err("The search result was discarded because the shopping category changed.");
          return text({ source: "live Shopify Global Catalog", summary: result.summary, products: result.products.map((product) => productSummary(product.id)) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          useStore.getState().failLiveSearch(searchId, message);
          return err(`${message} No demo fallback was used.`);
        }
      }),
    },
    {
      name: "get-live-results",
      description: "Read only the latest verified live Shopify results. Returns an error until a live agent search succeeds.",
      inputSchema: { type: "object", properties: {} },
      execute: async (args: unknown) => audited("get-live-results", args, () => {
        const state = useStore.getState();
        if (state.stage !== "results" || !state.liveProducts.length) return err("No completed live Shopify search is available.");
        return text({ source: "live Shopify Global Catalog", summary: state.searchSummary, products: state.liveProducts.map((product) => productSummary(product.id)) });
      }),
    },
    {
      name: "get-product",
      description: "Get a full product record from the latest live Shopify shortlist.",
      inputSchema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"] },
      execute: async (args: { productId?: unknown }) => audited("get-product", args, () => {
        const product = typeof args.productId === "string" ? liveProductById(args.productId) : undefined;
        if (!product || product.domain !== requireDomain()) return err("Unknown live product id for the active category.");
        return text(productSummary(product.id));
      }),
    },
    {
      name: "add-to-cart",
      description: "Propose adding a live result. Agent proposals never modify the confirmed cart until the human approves.",
      inputSchema: { type: "object", properties: { productId: { type: "string" }, qty: { type: "number" }, reason: { type: "string" } }, required: ["productId", "reason"] },
      execute: async (args: any) => audited("add-to-cart", args, () => {
        if (typeof args.productId !== "string" || typeof args.reason !== "string" || !args.reason.trim()) return err("productId and a non-empty reason are required.");
        const response = useStore.getState().addToCart(args.productId, args.qty ?? 1, "agent", args.reason);
        return response.ok ? text({ message: response.message, proposalId: response.proposalId, ...cartPayload() }) : err(response.message);
      }),
    },
    {
      name: "remove-from-cart",
      description: "Propose removing a confirmed cart item. Human approval is mandatory.",
      inputSchema: { type: "object", properties: { productId: { type: "string" }, reason: { type: "string" } }, required: ["productId", "reason"] },
      execute: async (args: any) => audited("remove-from-cart", args, () => {
        if (typeof args.productId !== "string" || typeof args.reason !== "string" || !args.reason.trim()) return err("productId and a non-empty reason are required.");
        const response = useStore.getState().removeFromCart(args.productId, "agent", args.reason);
        return response.ok ? text({ message: response.message, proposalId: response.proposalId, ...cartPayload() }) : err(response.message);
      }),
    },
    {
      name: "swap-item",
      description: "Propose an atomic swap between live results. The original item stays confirmed until approval.",
      inputSchema: { type: "object", properties: { removeProductId: { type: "string" }, addProductId: { type: "string" }, reason: { type: "string" } }, required: ["removeProductId", "addProductId", "reason"] },
      execute: async (args: any) => audited("swap-item", args, () => {
        if (typeof args.removeProductId !== "string" || typeof args.addProductId !== "string" || typeof args.reason !== "string" || !args.reason.trim()) return err("Both product ids and a non-empty reason are required.");
        const response = useStore.getState().swapItems(args.removeProductId, args.addProductId, args.reason);
        return response.ok ? text({ message: response.message, proposalId: response.proposalId, ...cartPayload() }) : err(response.message);
      }),
    },
    {
      name: "get-cart",
      description: "Read confirmed cart lines, separate pending proposals, and listed subtotals.",
      inputSchema: { type: "object", properties: {} },
      execute: async (args: unknown) => audited("get-cart", args, () => text(cartPayload())),
    },
    {
      name: "check-constraints",
      description: "Validate the projected cart against explicit numeric or allergen constraints. This checks current live result data; it does not generate recommendations.",
      inputSchema: { type: "object", properties: { maxTotalPrice: { type: "number", minimum: 0 }, currency: { type: "string", pattern: "^[A-Z]{3}$" }, maxKcalPerItem: { type: "number", minimum: 0 }, excludeAllergens: { type: "array", items: { type: "string" } }, minItems: { type: "number", minimum: 0 } } },
      execute: async (args: any) => audited("check-constraints", args, () => {
        const state = useStore.getState();
        const results = checkConstraints(projectedCart(state.cart, state.proposals), args);
        return text({ allPass: results.every((item) => item.pass), results, projected: true, ...cartPayload().totals });
      }),
    },
    {
      name: "set-preferences",
      description: "Save standing dietary preferences for cart checks. This does not start or replace the live agent search.",
      inputSchema: { type: "object", properties: { allergens: { type: "array", items: { type: "string" } }, diets: { type: "array", items: { type: "string" } }, weeklyBudget: { type: "number" } } },
      execute: async (args: Partial<Preferences>) => audited("set-preferences", args, () => {
        useStore.getState().setPreferences(args, "agent");
        return text({ message: "Preferences saved.", preferences: useStore.getState().preferences });
      }),
    },
    {
      name: "highlight-products",
      description: "Highlight products from the latest live shortlist in the visible results.",
      inputSchema: { type: "object", properties: { productIds: { type: "array", items: { type: "string" } }, note: { type: "string" } }, required: ["productIds"] },
      execute: async (args: any) => audited("highlight-products", args, () => {
        useStore.getState().setHighlight(Array.isArray(args.productIds) ? args.productIds : [], args.note);
        return text({ message: `Highlighted ${useStore.getState().highlight?.ids.length ?? 0} live product(s).` });
      }),
    },
  ];

export async function registerWebMcpTools(): Promise<boolean> {
  if (registered) return true;
  if (registration) return registration;
  const mc = getModelContext();
  if (!mc) return false;

  registration = (async () => {
    try {
      for (const tool of tools) {
        if (registeredToolNames.has(tool.name)) continue;
        await mc.registerTool(tool);
        registeredToolNames.add(tool.name);
      }
      registered = true;
      return true;
    } finally {
      registration = null;
    }
  })();
  return registration;
}
