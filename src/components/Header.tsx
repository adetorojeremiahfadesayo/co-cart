import { useEffect, useRef, useState } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import { cancelActiveSearch } from "../agent/searchCoordinator";
import { formatCurrencyTotals } from "../utils/money";

export default function Header() {
  const domain = useStore((s) => s.domain);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const setCartOpen = useStore((s) => s.setCartOpen);
  const cart = useStore((s) => s.cart);
  const proposals = useStore((s) => s.proposals);
  const brief = useStore((s) => s.brief);
  const [confirmChange, setConfirmChange] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const cartTotals = useStore((s) => s.cartTotals);
  const totals = cartTotals();
  const totalLabel = formatCurrencyTotals(totals.currencyTotals);
  const itemCount = cart.reduce((n, item) => n + item.qty, 0);
  const pendingCount = proposals.length;
  const config = domain ? DOMAIN_CONFIG[domain] : null;
  const hasWork = Boolean(brief || cart.length || proposals.length);

  const requestCategoryChange = () => {
    if (hasWork) setConfirmChange(true);
    else resetWorkspace();
  };

  const clearAndChange = () => {
    cancelActiveSearch();
    resetWorkspace();
  };

  useEffect(() => {
    if (!confirmChange) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmChange(false);
      if (event.key === "Tab") {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])") ?? []);
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
  }, [confirmChange]);

  return (
    <>
    <header className="app-header sticky top-3 z-40 mx-3 sm:mx-6">
      <div className="card-pop app-header__inner px-3 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={requestCategoryChange}
          className="app-header__brand flex min-w-0 items-center gap-2"
          aria-label="Co-Cart home — change category"
        >
          <span
            className="brand-mark"
            aria-hidden
          >
            CC
          </span>
          <span className="text-left">
            <span className="font-display block text-lg font-extrabold leading-none">Co-Cart</span>
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-grape-deep">
              {config ? config.label : "decision assistant"}
            </span>
          </span>
        </button>

        <div className="app-header__live"><span aria-hidden>●</span> Live agent</div>

        {config && (
          <button
            type="button"
            onClick={requestCategoryChange}
            className="btn-chunky app-header__change bg-white px-3 text-[11px]"
          >
            <span aria-hidden>↺</span><span className="change-category__label">Change category</span>
          </button>
        )}

        <div className="app-header__actions flex min-w-0 items-center gap-2">
          <button
            type="button"
            id="open-cart-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart: ${itemCount} items, listed subtotal ${totalLabel}`}
            className="btn-chunky app-header__cart relative min-w-0 bg-ink px-3 text-sm text-cream"
          >
            <span>Cart · {itemCount}</span><span className="app-header__cart-total"> · {totalLabel}</span>
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-sun px-1 text-[11px] font-black text-ink">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
    {confirmChange && (
      <div className="dialog-backdrop" role="presentation" onMouseDown={() => setConfirmChange(false)}>
        <div ref={dialogRef} className="decision-dialog" role="dialog" aria-modal="true" aria-labelledby="change-category-title" onMouseDown={(event) => event.stopPropagation()}>
          <p className="decision-dialog__icon" aria-hidden>↩</p>
          <h2 id="change-category-title">Change shopping category?</h2>
          <p>Your current brief, confirmed cart, and pending proposals will be cleared.</p>
          <div className="decision-dialog__actions">
            <button ref={cancelRef} type="button" className="button button--outline" onClick={() => setConfirmChange(false)}>Keep working</button>
            <button type="button" className="button button--danger" onClick={clearAndChange}>Clear and change</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
