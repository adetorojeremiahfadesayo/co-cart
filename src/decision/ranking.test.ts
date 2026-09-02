import { describe, expect, it } from "vitest";
import { catalogs, DOMAIN_CONFIG } from "../data/catalog";
import { rankProducts, scoreProduct } from "./ranking";

describe("ranking criteria", () => {
  it.each(["meals", "gadgets", "clothing"] as const)("returns up to three explainable %s choices", (domain) => {
    const ranked = rankProducts(domain, catalogs[domain], DOMAIN_CONFIG[domain].preset);
    expect(ranked).toHaveLength(3);
    expect(ranked.every((option) => option.results.length > 0 && option.roles.length > 0)).toBe(true);
  });

  it("treats deal-breakers as clearance checks", () => {
    const anc = catalogs.gadgets.find((product) => product.noiseCancelling);
    const noAnc = catalogs.gadgets.find((product) => !product.noiseCancelling);
    expect(anc).toBeDefined();
    expect(noAnc).toBeDefined();

    const accepted = scoreProduct("gadgets", anc!, DOMAIN_CONFIG.gadgets.preset);
    const rejected = scoreProduct("gadgets", noAnc!, DOMAIN_CONFIG.gadgets.preset);
    const acceptedBlocker = accepted.results.find((item) => item.kind === "deal-breaker");

    expect(acceptedBlocker?.criterion).toContain("Clears blocker");
    expect(acceptedBlocker?.status).toBe("pass");
    expect(rejected.eligible).toBe(false);
  });

  it("does not mark unverifiable hard requirements as eligible", () => {
    const brief = {
      ...DOMAIN_CONFIG.meals.preset,
      required: ["Certified by an unknown private standard"],
      dealBreakers: [],
    };
    const result = scoreProduct("meals", catalogs.meals[0], brief);

    expect(result.results[0].status).toBe("unknown");
    expect(result.eligible).toBe(false);
  });

  it("parses explicit clothing sizes instead of assuming medium", () => {
    const product = { ...catalogs.clothing[0], sizes: ["L"] };
    const result = scoreProduct("clothing", product, {
      ...DOMAIN_CONFIG.clothing.preset,
      required: ["Size L available"],
      dealBreakers: [],
    });

    expect(result.results[0].status).toBe("pass");
  });
});
