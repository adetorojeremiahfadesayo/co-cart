import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { formatCurrencyTotals } from "../utils/money";

export default function CheckoutConfirmation() {
  const checkedOut = useStore((s) => s.checkedOut);
  const newShop = useStore((s) => s.newShop);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!checkedOut) return;
    buttonRef.current?.focus();
  }, [checkedOut]);

  if (!checkedOut) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping plan confirmed"
    >
      <div className="card-pop relative w-full max-w-sm overflow-hidden p-8 text-center">
        <p className="inline-block text-6xl" aria-hidden>✓</p>
        <h2 className="font-display mt-3 text-3xl font-extrabold">Shopping plan confirmed</h2>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {checkedOut.itemCount} item{checkedOut.itemCount === 1 ? "" : "s"} ·{" "}
          <span className="sticker-price text-base">{formatCurrencyTotals(checkedOut.totals)}</span>
        </p>
        <p className="mt-2 text-xs font-bold text-ink-soft">
          Recorded at {checkedOut.at}. Co-Cart did not place an order or charge you; open each merchant listing to purchase.
        </p>
        <button
          onClick={newShop}
          ref={buttonRef}
          onKeyDown={(event) => {
            if (event.key === "Tab") event.preventDefault();
          }}
          className="btn-chunky mt-6 w-full bg-candy py-3.5 text-base text-white"
        >
          Start a new shop
        </button>
      </div>
    </div>
  );
}
