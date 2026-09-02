import { useEffect, useRef } from "react";
import { liveProductById, useStore } from "../store/useStore";
import CartItemRow from "./CartItemRow";
import ConstraintMeter from "./ConstraintMeter";
import { formatCurrencyTotals } from "../utils/money";

export default function CartPanel() {
  const cart = useStore((s) => s.cart);
  const proposals = useStore((s) => s.proposals);
  const cartOpen = useStore((s) => s.cartOpen);
  const setCartOpen = useStore((s) => s.setCartOpen);
  const approveAll = useStore((s) => s.approveAll);
  const rejectAll = useStore((s) => s.rejectAll);
  const approveProposal = useStore((s) => s.approveProposal);
  const rejectProposal = useStore((s) => s.rejectProposal);
  const checkout = useStore((s) => s.checkout);
  const log = useStore((s) => s.log);
  const panelRef = useRef<HTMLElement>(null);

  const pending = proposals.length;
  const itemCount = cart.reduce((n, item) => n + item.qty, 0);
  const cartTotals = useStore((s) => s.cartTotals);
  const totalLabel = formatCurrencyTotals(cartTotals().currencyTotals);

  const handleCheckout = () => {
    const r = checkout();
    if (!r.ok) log("system", `Checkout blocked — ${r.message}`);
  };

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!cartOpen) {
      panel.setAttribute("inert", "");
      return;
    }
    panel.removeAttribute("inert");
    panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        document.getElementById("open-cart-button")?.focus();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cartOpen, setCartOpen]);

  const closeCart = () => {
    setCartOpen(false);
    window.setTimeout(() => document.getElementById("open-cart-button")?.focus(), 0);
  };

  return (
    <>
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
          onClick={closeCart}
          aria-hidden
        />
      )}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        className={`cart-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l-[3px] border-ink bg-cream transition-transform duration-300 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b-[3px] border-ink bg-sun px-5 py-4">
          <h2 className="font-display text-xl font-extrabold">
            Your cart{" "}
            <span className="text-sm font-bold text-ink/60">
              ({itemCount} item{itemCount === 1 ? "" : "s"})
            </span>
          </h2>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="btn-chunky h-11 w-11 bg-white p-0 text-sm"
          >
            ✕
          </button>
        </div>

        {pending > 0 && (
          <div className="mx-4 mt-4 rounded-2xl border-[3px] border-ink bg-grape/15 p-3.5 pop-in">
            <p className="font-display text-sm font-extrabold text-grape-deep">
              {pending} change{pending === 1 ? "" : "s"} to review
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-ink-soft">
              Your agent's ideas — nothing is final until you approve.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => approveAll()}
                className="btn-chunky flex-1 border-[2.5px] bg-leaf px-3 py-1.5 text-xs text-white"
              >
                Approve all
              </button>
              <button
                onClick={() => rejectAll()}
                className="btn-chunky flex-1 border-[2.5px] bg-white px-3 py-1.5 text-xs text-ink"
              >
                Reject all
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="rounded-3xl border-[3px] border-dashed border-ink/30 bg-white/70 p-10 text-center">
              <p className="empty-cart-mark" aria-hidden>0</p>
              <p className="font-display mt-3 text-lg font-extrabold">Your cart is empty!</p>
              <p className="mt-1 text-xs font-bold text-ink-soft">
                Add a live recommendation after the agent finishes searching Shopify.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.map((item) => <CartItemRow key={item.productId} item={item} />)}
            </ul>
          )}

          {proposals.length > 0 && (
            <div className="mt-4 rounded-3xl border-[3px] border-dashed border-grape-deep/50 bg-white/80 p-4">
              <p className="font-display mb-2 text-xs font-extrabold uppercase tracking-wide text-grape-deep">
                Pending proposals
              </p>
              <ul className="space-y-2 text-xs font-bold text-ink">
                {proposals.map((proposal) => {
                  let summary = proposal.reason;
                  if (proposal.kind === "add" && proposal.productId) summary = `Add ${liveProductById(proposal.productId)?.name ?? "item"}: ${proposal.reason}`;
                  if (proposal.kind === "remove" && proposal.productId) summary = `Remove ${liveProductById(proposal.productId)?.name ?? "item"}: ${proposal.reason}`;
                  if (proposal.kind === "swap" && proposal.removeProductId && proposal.addProductId) summary = `Swap ${liveProductById(proposal.removeProductId)?.name ?? "item"} for ${liveProductById(proposal.addProductId)?.name ?? "item"}: ${proposal.reason}`;
                  return (
                    <li key={proposal.id} className="proposal-card">
                      <p>{summary}</p>
                      <div className="proposal-card__actions">
                        <button type="button" className="button button--approve" onClick={() => approveProposal(proposal.id)}>Approve</button>
                        <button type="button" className="button button--quiet" onClick={() => rejectProposal(proposal.id)}>Reject</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t-[3px] border-ink bg-white p-4">
          <ConstraintMeter />
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || pending > 0}
            className={`btn-chunky mt-3.5 w-full py-3.5 text-base text-white ${
              pending > 0 ? "bg-tang" : "bg-leaf-deep"
            }`}
          >
            {pending > 0
              ? `Review ${pending} proposal${pending === 1 ? "" : "s"} first`
              : `Confirm plan · ${totalLabel}`}
          </button>
        </div>
      </aside>
    </>
  );
}
