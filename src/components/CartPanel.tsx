import { productById, useStore } from "../store/useStore";
import CartItemRow from "./CartItemRow";
import ConstraintMeter from "./ConstraintMeter";

export default function CartPanel() {
  const cart = useStore((s) => s.cart);
  const cartOpen = useStore((s) => s.cartOpen);
  const setCartOpen = useStore((s) => s.setCartOpen);
  const approveAll = useStore((s) => s.approveAll);
  const rejectAll = useStore((s) => s.rejectAll);
  const checkout = useStore((s) => s.checkout);
  const log = useStore((s) => s.log);

  const pending = cart.filter((i) => i.status !== "confirmed").length;
  const active = cart.filter((i) => i.status !== "proposed-removal");
  const itemCount = active.reduce((n, i) => n + i.qty, 0);
  const total = active.reduce(
    (sum, i) => sum + (productById(i.productId)?.price ?? 0) * i.qty,
    0,
  );

  const handleCheckout = () => {
    const r = checkout();
    if (!r.ok) log("system", `Checkout blocked — ${r.message}`);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCartOpen(!cartOpen)}
        aria-expanded={cartOpen}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-bold text-white shadow-lg lg:hidden"
      >
        🛒 {itemCount}
        {pending > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
            {pending} to review
          </span>
        )}
      </button>

      <aside
        aria-label="Shopping cart"
        className={`fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-stone-200 bg-white shadow-xl transition-transform lg:static lg:z-auto lg:w-96 lg:translate-x-0 lg:shadow-none ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 p-4">
          <h2 className="text-sm font-bold">
            Your cart{" "}
            <span className="font-normal text-stone-500">
              ({itemCount} item{itemCount === 1 ? "" : "s"})
            </span>
          </h2>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        <div aria-live="polite" className="sr-only">
          {pending > 0
            ? `${pending} agent proposal${pending === 1 ? "" : "s"} awaiting your approval.`
            : ""}
        </div>

        {pending > 0 && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">
              🤖 {pending} change{pending === 1 ? "" : "s"} to review
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => approveAll()}
                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                ✓ Approve all
              </button>
              <button
                onClick={() => rejectAll()}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
              >
                ✕ Reject all
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              <p className="text-3xl" aria-hidden>
                🛒
              </p>
              <p className="mt-2">Your cart is empty.</p>
              <p className="mt-1 text-xs">
                Browse the store — or ask your agent:{" "}
                <em>"3 dinners under 400 kcal, no peanuts, under $60"</em>
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {cart.map((i) => (
                <CartItemRow key={i.productId} item={i} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-stone-100 p-4">
          <ConstraintMeter />
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
              cart.length === 0
                ? "cursor-not-allowed bg-stone-200 text-stone-400"
                : pending > 0
                  ? "bg-amber-400 text-amber-950 hover:bg-amber-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {pending > 0
              ? `Review ${pending} proposal${pending === 1 ? "" : "s"} before checkout`
              : `Checkout · $${total.toFixed(2)}`}
          </button>
        </div>
      </aside>
    </>
  );
}
