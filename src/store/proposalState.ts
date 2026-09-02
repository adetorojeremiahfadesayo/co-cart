import type { CartProposal, ConfirmedCartItem } from "../types";

export interface CommerceState {
  cart: ConfirmedCartItem[];
  proposals: CartProposal[];
}

let proposalSequence = 0;

export function createProposalId() {
  proposalSequence += 1;
  return `proposal-${Date.now()}-${proposalSequence}`;
}

const proposalBase = (kind: CartProposal["kind"], qty: number, reason: string) => ({
  id: createProposalId(),
  kind,
  qty,
  reason,
  createdAt: new Date().toISOString(),
});

export function proposeAdd(state: CommerceState, productId: string, qty: number, reason: string): CommerceState {
  return {
    ...state,
    proposals: [...state.proposals, { ...proposalBase("add", qty, reason), productId }],
  };
}

export function proposeRemove(state: CommerceState, productId: string, qty: number, reason: string): CommerceState {
  return {
    ...state,
    proposals: [...state.proposals, { ...proposalBase("remove", qty, reason), productId }],
  };
}

export function proposeSwap(
  state: CommerceState,
  removeProductId: string,
  addProductId: string,
  qty: number,
  reason: string,
): CommerceState {
  return {
    ...state,
    proposals: [
      ...state.proposals,
      { ...proposalBase("swap", qty, reason), removeProductId, addProductId },
    ],
  };
}

function addConfirmed(cart: ConfirmedCartItem[], productId: string, qty: number) {
  const found = cart.find((item) => item.productId === productId);
  if (!found) return [...cart, { productId, qty }];
  return cart.map((item) =>
    item.productId === productId ? { ...item, qty: item.qty + qty } : item,
  );
}

function removeConfirmed(cart: ConfirmedCartItem[], productId: string, qty: number) {
  return cart
    .map((item) =>
      item.productId === productId ? { ...item, qty: Math.max(0, item.qty - qty) } : item,
    )
    .filter((item) => item.qty > 0);
}

export function resolveProposal(
  state: CommerceState,
  proposalId: string,
  decision: "approve" | "reject",
): CommerceState {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return state;
  if (decision === "reject") {
    return { ...state, proposals: state.proposals.filter((item) => item.id !== proposalId) };
  }

  let cart = state.cart;
  if (proposal.kind === "add" && proposal.productId) {
    cart = addConfirmed(cart, proposal.productId, proposal.qty);
  } else if (proposal.kind === "remove" && proposal.productId) {
    cart = removeConfirmed(cart, proposal.productId, proposal.qty);
  } else if (proposal.kind === "swap" && proposal.removeProductId && proposal.addProductId) {
    cart = addConfirmed(
      removeConfirmed(cart, proposal.removeProductId, proposal.qty),
      proposal.addProductId,
      proposal.qty,
    );
  }
  return { cart, proposals: state.proposals.filter((item) => item.id !== proposalId) };
}
