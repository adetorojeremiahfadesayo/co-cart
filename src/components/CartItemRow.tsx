import { liveProductById, useStore } from "../store/useStore";
import type { ConfirmedCartItem } from "../types";
import { formatMoney } from "../utils/money";

export default function CartItemRow({ item }: { item: ConfirmedCartItem }) {
  const updateQty = useStore((s) => s.updateQty);
  const removeFromCart = useStore((s) => s.removeFromCart);

  const p = liveProductById(item.productId);
  if (!p) return null;

  return (
    <li className="cart-line">
      <div className="flex items-start gap-2">
        <span className="text-2xl select-none" aria-hidden>
          {p.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-extrabold leading-snug"
          >
            {p.name}
          </p>
          <p className="text-[11px] text-stone-500">
            {p.merchant} · {formatMoney(p.price, p.currency)} each
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
            <div className="cart-line__quantity" aria-label={`Quantity of ${p.name}`}>
              <button
                onClick={() => updateQty(item.productId, item.qty - 1)}
                aria-label="Decrease quantity"
                className="quantity-button"
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-semibold">{item.qty}</span>
              <button
                onClick={() => updateQty(item.productId, item.qty + 1)}
                aria-label="Increase quantity"
                className="quantity-button"
              >
                +
              </button>
            </div>
          <button
            onClick={() => removeFromCart(item.productId, "user")}
            aria-label={`Remove ${p.name} from cart`}
            className="cart-line__remove"
          >
            remove
          </button>
        </div>
      </div>
    </li>
  );
}
