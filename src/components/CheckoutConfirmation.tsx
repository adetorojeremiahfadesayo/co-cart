import { useStore } from "../store/useStore";

export default function CheckoutConfirmation() {
  const checkedOut = useStore((s) => s.checkedOut);
  const newShop = useStore((s) => s.newShop);

  if (!checkedOut) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Order confirmed"
    >
      <div className="card-in w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-6xl" aria-hidden>
          ✅
        </p>
        <h2 className="mt-3 text-xl font-bold">Order confirmed!</h2>
        <p className="mt-2 text-sm text-stone-600">
          {checkedOut.itemCount} item{checkedOut.itemCount === 1 ? "" : "s"} ·{" "}
          <strong>${checkedOut.total.toFixed(2)}</strong>
        </p>
        <p className="mt-1 text-xs text-stone-400">Placed at {checkedOut.at} — this is a demo store, nothing was charged.</p>
        <button
          onClick={newShop}
          className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-700"
        >
          Start a new shop
        </button>
      </div>
    </div>
  );
}
