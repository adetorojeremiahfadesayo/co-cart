import {
  checkConstraints,
  filteredProducts,
  productById,
  useStore,
} from "../store/useStore";

type Json = Record<string, unknown>;

const text = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
});

const err = (message: string) => ({
  content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  isError: true,
});

function getModelContext(): any | null {
  const nav = navigator as any;
  if (nav.modelContext) return nav.modelContext;
  const doc = document as any;
  if (doc.modelContext) return doc.modelContext;
  return null;
}

export function webmcpSupported(): boolean {
  return getModelContext() != null;
}

function cartPayload() {
  const s = useStore.getState();
  const totals = s.cartTotals();
  return {
    cart: s.cart.map((i) => {
      const p = productById(i.productId);
      return {
        productId: i.productId,
        name: p?.name,
        qty: i.qty,
        unitPrice: p?.price,
        kcalPerServing: p?.kcalPerServing,
        allergens: p?.allergens,
        status: i.status,
        source: i.source,
        reason: i.reason,
        swappedFromId: i.swappedFromId,
      };
    }),
    totals: {
      totalPrice: Number(totals.total.toFixed(2)),
      totalKcal: totals.kcal,
      itemCount: totals.itemCount,
      pendingApprovalCount: totals.pendingCount,
    },
    note:
      totals.pendingCount > 0
        ? `${totals.pendingCount} change(s) are proposed and awaiting the user's approval. The user can approve or reject in the cart panel.`
        : undefined,
  };
}

const productSummary = (id: string) => {
  const p = productById(id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    kcalPerServing: p.kcalPerServing,
    proteinG: p.proteinG,
    allergens: p.allergens,
    diets: p.diets,
    tags: p.tags,
    prepMinutes: p.prepMinutes,
  };
};

let registered = false;

export async function registerWebMcpTools(): Promise<boolean> {
  if (registered) return true;
  const mc = getModelContext();
  if (!mc) return false;
  registered = true;

  const store = () => useStore.getState();

  const tools = [
    {
      name: "search-products",
      description:
        "Search and filter the Co-Cart meal-kit catalog. Also updates the visible product grid in the UI so the user sees what you found. Use this first to find products matching the user's needs. Allergen and diet values: peanut, tree-nut, gluten, dairy, soy, shellfish, egg, fish, sesame; vegan, vegetarian, gluten-free, keto, high-protein.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search over names, descriptions, and tags." },
          category: { type: "string", enum: ["dinner", "lunch", "breakfast", "snack", "dessert"] },
          maxKcal: { type: "number", description: "Maximum kcal per serving." },
          minProtein: { type: "number", description: "Minimum protein grams per serving." },
          maxPrice: { type: "number", description: "Maximum price in USD." },
          excludeAllergens: {
            type: "array",
            items: { type: "string" },
            description: "Allergens to exclude, e.g. [\"peanut\"].",
          },
          diets: { type: "array", items: { type: "string" }, description: "Required diets, e.g. [\"vegan\"]." },
          tags: { type: "array", items: { type: "string" }, description: "Match any tag, e.g. [\"spicy\", \"quick\"]." },
          limit: { type: "number", description: "Max results returned (default 12)." },
        },
      },
      execute: async (args: any) => {
        try {
          const limit = typeof args.limit === "number" ? args.limit : 12;
          store().setFilter(
            {
              query: args.query ?? "",
              category: args.category ?? "all",
              maxKcal: args.maxKcal,
              minProtein: args.minProtein,
              maxPrice: args.maxPrice,
              excludeAllergens: args.excludeAllergens ?? [],
              diets: args.diets ?? [],
              tags: args.tags ?? [],
              agentFiltered: true,
              note: "Filtered by your agent",
            },
            "agent",
          );
          const matches = filteredProducts(useStore.getState().filters);
          return text({
            matchCount: matches.length,
            products: matches.slice(0, limit).map((p) => productSummary(p.id)),
            note: "The on-screen product grid now shows these results.",
          });
        } catch (e: any) {
          return err(`search-products failed: ${e?.message ?? e}`);
        }
      },
    },
    {
      name: "get-product",
      description: "Get full details for one product by its id (from search-products results).",
      inputSchema: {
        type: "object",
        properties: { productId: { type: "string", description: "Product id, e.g. \"p-004\"." } },
        required: ["productId"],
      },
      execute: async (args: any) => {
        const p = productById(args?.productId);
        if (!p) return err(`Unknown product id "${args?.productId}". Use search-products to find valid ids.`);
        return text(p);
      },
    },
    {
      name: "add-to-cart",
      description:
        "Add a product to the cart on the user's behalf. The item is added in a PROPOSED state — the user sees it with an agent badge and must approve it. Always pass a short human-readable reason. After adding everything the user asked for, tell the user what you proposed and ask them to review.",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "string" },
          qty: { type: "number", description: "Quantity (default 1)." },
          reason: { type: "string", description: "Why this fits the user's request, e.g. \"380 kcal, peanut-free, $8.99\"." },
        },
        required: ["productId"],
      },
      execute: async (args: any) => {
        const r = store().addToCart(args?.productId, args?.qty ?? 1, "agent", args?.reason);
        if (!r.ok) return err(r.message);
        return text({ message: r.message, ...cartPayload() });
      },
    },
    {
      name: "remove-from-cart",
      description:
        "Remove an item from the cart. If the user added the item themselves, it becomes a proposed removal (strikethrough) that the user must approve. Always pass a reason.",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "string" },
          reason: { type: "string", description: "Why remove it, e.g. \"exceeds the kcal limit\"." },
        },
        required: ["productId"],
      },
      execute: async (args: any) => {
        const r = store().removeFromCart(args?.productId, "agent", args?.reason);
        if (!r.ok) return err(r.message);
        return text({ message: r.message, ...cartPayload() });
      },
    },
    {
      name: "swap-item",
      description:
        "Replace one cart item with another product in a single step (e.g. swap out an allergen). The swap appears as a proposal the user must approve. Reason is required and is shown to the user.",
      inputSchema: {
        type: "object",
        properties: {
          removeProductId: { type: "string", description: "Product id currently in the cart." },
          addProductId: { type: "string", description: "Replacement product id." },
          reason: { type: "string", description: "e.g. \"peanut allergy: satay contains peanuts\"" },
        },
        required: ["removeProductId", "addProductId", "reason"],
      },
      execute: async (args: any) => {
        const r = store().swapItems(args?.removeProductId, args?.addProductId, args?.reason ?? "");
        if (!r.ok) return err(r.message);
        return text({ message: r.message, ...cartPayload() });
      },
    },
    {
      name: "get-cart",
      description:
        "Get the full current cart: items with their status (confirmed / proposed / proposed-removal), reasons, and totals (price, kcal, pending approvals). Use this before checkout or when asked what's in the cart.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => text(cartPayload()),
    },
    {
      name: "check-constraints",
      description:
        "Validate the current cart against constraints such as total budget, max kcal per item, excluded allergens, and minimum item count. Returns pass/fail per constraint with the ids of violating items so you can fix them (use swap-item or remove-from-cart). Use this to verify your work before asking the user to approve.",
      inputSchema: {
        type: "object",
        properties: {
          maxTotalPrice: { type: "number" },
          maxKcalPerItem: { type: "number" },
          excludeAllergens: { type: "array", items: { type: "string" } },
          minItems: { type: "number" },
        },
      },
      execute: async (args: any) => {
        const results = checkConstraints(useStore.getState().cart, {
          maxTotalPrice: args?.maxTotalPrice,
          maxKcalPerItem: args?.maxKcalPerItem,
          excludeAllergens: args?.excludeAllergens,
          minItems: args?.minItems,
        });
        store().log(
          "agent",
          `Checked constraints: ${results.map((r) => `${r.label} ${r.pass ? "✓" : "✗"}`).join(", ")}`,
          "check-constraints",
        );
        return text({
          allPass: results.every((r) => r.pass),
          results,
          ...cartPayload().totals,
        });
      },
    },
    {
      name: "set-preferences",
      description:
        "Save the user's standing preferences: allergens to always avoid, diets they follow, and weekly budget in USD. Persisted across visits and shown as chips in the header. Call this when the user mentions an allergy, diet, or budget.",
      inputSchema: {
        type: "object",
        properties: {
          allergens: { type: "array", items: { type: "string" }, description: "e.g. [\"peanut\"]" },
          diets: { type: "array", items: { type: "string" }, description: "e.g. [\"vegetarian\"]" },
          weeklyBudget: { type: "number" },
        },
      },
      execute: async (args: any) => {
        const patch: Json = {};
        if (Array.isArray(args?.allergens)) patch.allergens = args.allergens;
        if (Array.isArray(args?.diets)) patch.diets = args.diets;
        if (typeof args?.weeklyBudget === "number") patch.weeklyBudget = args.weeklyBudget;
        store().setPreferences(patch);
        return text({ message: "Preferences saved.", preferences: useStore.getState().preferences });
      },
    },
    {
      name: "highlight-products",
      description:
        "Visually highlight products in the grid (pulsing outline) to show the user which items you're talking about. Use after picking items so the user can see your choices.",
      inputSchema: {
        type: "object",
        properties: {
          productIds: { type: "array", items: { type: "string" } },
          note: { type: "string", description: "Short caption, e.g. \"my three picks for you\"" },
        },
        required: ["productIds"],
      },
      execute: async (args: any) => {
        const ids = Array.isArray(args?.productIds) ? args.productIds : [];
        store().setHighlight(ids, args?.note);
        return text({ message: `Highlighted ${ids.length} product(s) in the grid.` });
      },
    },
    {
      name: "checkout",
      description:
        "Complete the purchase. IMPORTANT: checkout is refused while any proposed change is awaiting the user's approval — call get-cart first, and if pendingApprovalCount > 0, ask the user to approve or reject the proposals instead of retrying.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const r = store().checkout();
        if (!r.ok) return err(r.message);
        return text({ message: r.message });
      },
    },
  ];

  for (const tool of tools) {
    await mc.registerTool(tool);
  }
  return true;
}
