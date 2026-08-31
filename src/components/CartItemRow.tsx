import { productById, useStore } from "../store/useStore";
import type { CartItem } from "../types";

export default function CartItemRow({ item }: { item: CartItem }) {
  const approveItem = useStore((s) => s.approveItem);
  const rejectItem = useStore((s) => s.rejectItem);
  const updateQty = useStore((s) => s.updateQty);
  const removeFromCart = useStore((s) => s.removeFromCart);

  const p = productById(item.productId);
  if (!p) return null;
  const from = item.swappedFromId ? productById(item.swappedFromId) : null;

  const proposed = item.status === "proposed";
  const proposedRemoval = item.status === "proposed-removal";

  return (
    <li
      className={`rounded-xl border p-3 transition ${
        proposed
          ? "border-amber-300 bg-amber-50"
          : proposedRemoval
            ? "border-amber-300 bg-amber-50 opacity-80"
            : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl select-none" aria-hidden>
          {p.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold leading-snug ${
              proposedRemoval ? "line-through text-stone-500" : ""
            }`}
          >
            {p.name}
          </p>
          <p className="text-[11px] text-stone-500">
            ${p.price.toFixed(2)} · {p.kcalPerServing} kcal
          </p>

          {(proposed || proposedRemoval) && (
            <div className="mt-1.5 rounded-lg bg-amber-100/70 p-2">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
                <span aria-hidden>🤖</span>
                {proposedRemoval
                  ? "Agent proposes removing this"
                  : from
                    ? `Agent swap: ${from.name} → ${p.name}`
                    : "Agent proposed"}
              </p>
              {item.reason && (
                <p className="mt-0.5 text-[11px] text-amber-800">{item.reason}</p>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={() => approveItem(item.productId)}
                  aria-label={`Approve ${p.name}`}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => rejectItem(item.productId)}
                  aria-label={`Reject ${p.name}`}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {!proposedRemoval && (
            <div className="flex items-center gap-1" aria-label={`Quantity of ${p.name}`}>
              <button
                onClick={() => updateQty(item.productId, item.qty - 1)}
                aria-label="Decrease quantity"
                className="h-6 w-6 rounded-md bg-stone-100 text-xs font-bold hover:bg-stone-200"
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
              <button
                onClick={() => updateQty(item.productId, item.qty + 1)}
                aria-label="Increase quantity"
                className="h-6 w-6 rounded-md bg-stone-100 text-xs font-bold hover:bg-stone-200"
              >
                +
              </button>
            </div>
          )}
          <button
            onClick={() => removeFromCart(item.productId, "user")}
            aria-label={`Remove ${p.name} from cart`}
            className="text-[11px] font-medium text-stone-400 underline hover:text-red-600"
          >
            remove
          </button>
        </div>
      </div>
    </li>
  );
}
