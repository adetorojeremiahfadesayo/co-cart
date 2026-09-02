import type {
  CriterionResult,
  DecisionBrief,
  DecisionDomain,
  Product,
  RankedOption,
  ShortlistRole,
} from "../types";

const numberIn = (value: string) => Number(value.match(/\d+(?:\.\d+)?/)?.[0]);

const makeResult = (
  criterion: string,
  status: CriterionResult["status"],
  detail: string,
  kind: CriterionResult["kind"],
  maxPoints: number,
): CriterionResult => ({
  criterion,
  status,
  detail,
  kind,
  maxPoints,
  points: status === "pass" ? maxPoints : 0,
});

function evaluateMeals(product: Product, criterion: string) {
  const c = criterion.toLowerCase();
  if (c.includes("dinner")) return [product.category === "dinner", `${product.category} option`] as const;
  if (c.includes("calor") || c.includes("kcal")) {
    const max = numberIn(c) || 400;
    return [
      product.kcalPerServing != null && product.kcalPerServing <= max,
      product.kcalPerServing == null ? "Calories not listed" : `${product.kcalPerServing} kcal per serving`,
    ] as const;
  }
  if (c.includes("minute") || c.includes("ready") || c.includes("quick")) {
    const max = numberIn(c) || 30;
    return [
      product.prepMinutes != null && product.prepMinutes <= max,
      product.prepMinutes == null ? "Prep time not listed" : `${product.prepMinutes} min prep`,
    ] as const;
  }
  if (c.includes("protein"))
    return [(product.proteinG ?? 0) >= 25, `${product.proteinG ?? "—"} g protein per serving`] as const;
  if (c.includes("fresh") || c.includes("light"))
    return [product.tags.some((tag) => ["fresh", "light"].includes(tag)), product.tags.join(", ")] as const;
  if (c.includes("peanut")) {
    const contains = (product.allergens ?? []).includes("peanut");
    const wantsContains = c.includes("contains") && !c.includes("free") && !c.includes("no ");
    return [wantsContains ? contains : !contains, contains ? "Contains peanut" : "Peanut not listed"] as const;
  }
  return null;
}

function evaluateGadgets(product: Product, criterion: string) {
  const c = criterion.toLowerCase();
  if (c.includes("noise") || c.includes("anc")) {
    const pass = Boolean(product.noiseCancelling);
    return [pass, pass ? "Active noise cancelling listed" : "No active noise cancelling"] as const;
  }
  if (c.includes("wireless")) return [Boolean(product.wireless), product.wireless ? "Wireless" : "Wired only"] as const;
  if (c.includes("battery")) {
    const min = numberIn(c) || 40;
    return [(product.batteryHours ?? 0) >= min, `${product.batteryHours ?? "—"} h listed battery`] as const;
  }
  if (c.includes("weight") || c.includes("270") || c.includes("lightweight")) {
    const max = numberIn(c) || 270;
    return [(product.weightG ?? Infinity) <= max, `${product.weightG ?? "—"} g`] as const;
  }
  if (c.includes("multipoint")) {
    const pass = product.tags.includes("multipoint");
    return [pass, pass ? "Multipoint listed" : "Multipoint not listed"] as const;
  }
  return null;
}

function evaluateClothing(product: Product, criterion: string) {
  const c = criterion.toLowerCase();
  if (c.includes("size") || c.includes("medium")) {
    const shorthand = c.match(/\b(?:size\s*)?(xs|s|m|l|xl|xxl)\b/)?.[1]?.toUpperCase();
    const wanted = c.includes("medium") ? "M" : shorthand;
    if (!wanted) return null;
    return [(product.sizes ?? []).includes(wanted), `Sizes: ${(product.sizes ?? []).join(", ") || "not listed"}`] as const;
  }
  if (c.includes("breath"))
    return [product.breathability === "high", `${product.breathability ?? "unknown"} breathability`] as const;
  if (c.includes("wedding") || c.includes("outdoor")) {
    const pass = product.tags.includes("outdoor-wedding");
    return [pass, pass ? "Outdoor-wedding tag listed" : `${product.formality ?? "unknown"} formality`] as const;
  }
  if (c.includes("formal")) return [product.formality === "formal", `${product.formality ?? "unknown"} finish`] as const;
  if (c.includes("fabric") || c.includes("natural") || c.includes("low-impact")) {
    const materials = (product.materials ?? []).join(" ").toLowerCase();
    const pass = ["linen", "cotton", "hemp", "tencel"].some((name) => materials.includes(name));
    return [pass, (product.materials ?? []).join(", ") || "Materials not listed"] as const;
  }
  return null;
}

function evaluateKnown(domain: DecisionDomain, product: Product, criterion: string) {
  return domain === "meals"
    ? evaluateMeals(product, criterion)
    : domain === "gadgets"
      ? evaluateGadgets(product, criterion)
      : evaluateClothing(product, criterion);
}

function evaluateCriterion(
  domain: DecisionDomain,
  product: Product,
  criterion: string,
  kind: CriterionResult["kind"],
  points: number,
) {
  if (kind === "deal-breaker") {
    const c = criterion.toLowerCase();
    let clearance: readonly [boolean, string] | null = null;
    if (domain === "meals" && c.includes("peanut")) {
      const contains = (product.allergens ?? []).includes("peanut");
      clearance = [!contains, contains ? "Contains peanut" : "Peanut not listed"];
    } else if (domain === "gadgets" && (c.includes("noise") || c.includes("anc"))) {
      clearance = [Boolean(product.noiseCancelling), product.noiseCancelling ? "Active noise cancelling listed" : "No active noise cancelling"];
    } else if (domain === "clothing" && (c.includes("size") || c.includes("unavailable"))) {
      clearance = evaluateClothing(product, criterion);
    } else {
      const knownBlocker = evaluateKnown(domain, product, criterion);
      clearance = knownBlocker ? [!knownBlocker[0], knownBlocker[1]] : null;
    }
    if (!clearance) return makeResult(`Clears blocker: ${criterion}`, "unknown", "Not verifiable from the available demo fields", kind, points);
    return makeResult(`Clears blocker: ${criterion}`, clearance[0] ? "pass" : "fail", clearance[1], kind, points);
  }
  const known = evaluateKnown(domain, product, criterion);
  if (!known) return makeResult(criterion, "unknown", "Not verifiable from the available demo fields", kind, points);
  return makeResult(criterion, known[0] ? "pass" : "fail", known[1], kind, points);
}

export function scoreProduct(domain: DecisionDomain, product: Product, brief: DecisionBrief): RankedOption {
  const results: CriterionResult[] = [
    ...brief.required.map((criterion) => evaluateCriterion(domain, product, criterion, "required", 30)),
    ...brief.preferred.map((criterion) => evaluateCriterion(domain, product, criterion, "preferred", 10)),
    ...brief.dealBreakers.map((criterion) => evaluateCriterion(domain, product, criterion, "deal-breaker", 35)),
  ];

  if (brief.budget != null) {
    const allowance = brief.budget / Math.max(brief.targetCount, 1);
    results.push(
      makeResult(
        `Listed price within $${brief.budget.toFixed(0)}${brief.targetCount > 1 ? ` total target ($${allowance.toFixed(2)} per option)` : " budget"}`,
        product.price <= allowance ? "pass" : "fail",
        `$${product.price.toFixed(2)} listed by ${product.merchant}; shipping and tax not included`,
        "budget",
        20,
      ),
    );
  }

  if (brief.deliveryDeadline) {
    const maxDays = numberIn(brief.deliveryDeadline);
    const known = product.deliveryDays != null && Number.isFinite(maxDays);
    results.push(
      makeResult(
        brief.deliveryDeadline,
        !known ? "unknown" : product.deliveryDays! <= maxDays ? "pass" : "fail",
        product.deliveryDays == null ? "Delivery estimate not listed" : `${product.deliveryDays}-day demo delivery estimate`,
        "delivery",
        10,
      ),
    );
  }

  const unresolvedHardCriteria = results.filter(
    (item) => (item.kind === "required" || item.kind === "deal-breaker") && item.status !== "pass",
  );
  const maxScore = results.reduce((sum, item) => sum + item.maxPoints, 0);
  const score = results.reduce((sum, item) => sum + item.points, 0);
  const tradeoffs = results
    .filter((item) => item.status !== "pass")
    .slice(0, 3)
    .map((item) => `${item.criterion}: ${item.detail}`);

  return {
    product,
    roles: [],
    score,
    maxScore,
    eligible: unresolvedHardCriteria.length === 0,
    results,
    tradeoffs: tradeoffs.length ? tradeoffs : ["No failed criteria in the current brief."],
  };
}

export function rankProducts(domain: DecisionDomain, catalog: Product[], brief: DecisionBrief): RankedOption[] {
  const ranked = catalog
    .map((product) => scoreProduct(domain, product, brief))
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        b.score - a.score ||
        a.product.price - b.product.price ||
        a.product.id.localeCompare(b.product.id),
    );

  const shortlist = ranked.slice(0, 3).map((option) => ({ ...option, roles: [] as ShortlistRole[] }));
  if (shortlist[0]) shortlist[0].roles.push(shortlist[0].eligible ? "Best overall match" : "Best available, needs verification");
  const lowest = shortlist.reduce<RankedOption | undefined>(
    (best, item) => (!best || item.product.price < best.product.price ? item : best),
    undefined,
  );
  lowest?.roles.push("Lowest listed price");
  const alternative = shortlist.find((item) => item !== shortlist[0] && item !== lowest) ?? shortlist[1];
  alternative?.roles.push("Best alternative");
  shortlist.forEach((item) => {
    if (item.roles.length === 0) item.roles.push("Close contender");
  });
  return shortlist;
}

export const SCORE_FORMULA =
  "Required +30 each · preferred +10 each · budget +20 · delivery +10 · deal-breaker clearance +35 each. Failed or unverifiable required and deal-breaker criteria rank behind verified options; ties use lower listed price, then product id.";
