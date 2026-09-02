import { describe, expect, it } from "vitest";
import { proposeAdd, proposeRemove, proposeSwap, resolveProposal } from "./proposalState";

describe("proposal state", () => {
  const original = { cart: [{ productId: "p001", qty: 2 }], proposals: [] };

  it("never changes the confirmed cart when a proposal is rejected", () => {
    const add = proposeAdd(original, "p002", 1, "alternative");
    const remove = proposeRemove(original, "p001", 2, "remove it");
    const swap = proposeSwap(original, "p001", "p002", 2, "better fit");

    expect(resolveProposal(add, add.proposals[0].id, "reject").cart).toEqual(original.cart);
    expect(resolveProposal(remove, remove.proposals[0].id, "reject").cart).toEqual(original.cart);
    expect(resolveProposal(swap, swap.proposals[0].id, "reject").cart).toEqual(original.cart);
  });

  it("applies approved proposals sequentially without embedding proposal metadata", () => {
    const withAdd = proposeAdd(original, "p001", 1, "one more");
    const withSwap = proposeSwap(withAdd, "p001", "p002", 2, "swap two");
    const approvedAdd = resolveProposal(withSwap, withAdd.proposals[0].id, "approve");
    const approvedSwap = resolveProposal(approvedAdd, withSwap.proposals[1].id, "approve");

    expect(approvedSwap.cart).toEqual([
      { productId: "p001", qty: 1 },
      { productId: "p002", qty: 2 },
    ]);
    expect(approvedSwap.proposals).toEqual([]);
  });
});
