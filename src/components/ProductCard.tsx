import { liveProductById, useStore } from "../store/useStore";
import { formatMoney } from "../utils/money";

export default function ProductCard({
  id,
  highlighted,
}: {
  id: string;
  highlighted: boolean;
}) {
  const cart = useStore((s) => s.cart);
  const preferences = useStore((s) => s.preferences);
  const addToCart = useStore((s) => s.addToCart);

  const p = liveProductById(id);
  if (!p) return null;

  const inCart = cart.find((i) => i.productId === id);
  const allergens = p.allergens ?? [];
  const diets = p.diets ?? [];
  const hasAllergen = preferences.allergens.some((a) => allergens.includes(a));
  const dietMatch = preferences.diets.length > 0 && preferences.diets.every((d) => diets.includes(d));
  const price = formatMoney(p.price, p.currency);

  return (
    <div
      data-product-id={p.id}
      className={`card-pop product-card group relative flex h-full flex-col overflow-hidden ${
        highlighted ? "agent-highlight" : ""
      }`}
    >
      <div className={`product-visual product-visual--${p.domain}`}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={`${p.name} from ${p.merchant}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />
        ) : <span>{p.emoji}</span>}
        <span className="sticker-price absolute right-3 top-3 text-sm">
          {price}
        </span>
        {inCart && (
          <span className="chip absolute left-3 top-3 !border-leaf-deep bg-leaf text-white">
            ✓ In cart ×{inCart.qty}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display text-base font-extrabold leading-snug">{p.name}</h3>
        <p className="product-merchant">{p.merchant}</p>
        <p className="line-clamp-3 text-xs font-semibold text-ink-soft">{p.description}</p>
        {p.recommendation && <p className="product-reason"><strong>Why it fits</strong>{p.recommendation}</p>}
        {p.tradeoffs?.length ? <p className="product-tradeoff"><strong>Tradeoff</strong>{p.tradeoffs[0]}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
          {p.kcalPerServing != null && (
            <span className="chip !text-[10px]">{p.kcalPerServing} kcal</span>
          )}
          {p.proteinG != null && (
            <span className="chip !text-[10px]">{p.proteinG}g protein</span>
          )}
          {p.prepMinutes != null && p.prepMinutes > 0 && (
            <span className="chip !text-[10px]">Prep {p.prepMinutes} min</span>
          )}
          {p.batteryHours != null && (
            <span className="chip !text-[10px]">Battery {p.batteryHours}h</span>
          )}
          {p.noiseCancelling != null && (
            <span className="chip !text-[10px]">{p.noiseCancelling ? "ANC" : "No ANC"}</span>
          )}
          {p.weightG != null && <span className="chip !text-[10px]">{p.weightG}g</span>}
          {p.tags.includes("multipoint") && <span className="chip !text-[10px]">Multipoint</span>}
          {p.sizes?.length ? <span className="chip !text-[10px]">Sizes {p.sizes.join("/")}</span> : null}
          {p.materials?.length ? <span className="chip !text-[10px]">{p.materials.join(" + ")}</span> : null}
          {p.breathability && <span className="chip !text-[10px]">{p.breathability} breathability</span>}
          {p.formality && <span className="chip !text-[10px]">{p.formality}</span>}
          {p.brand && <span className="chip !text-[10px]">{p.brand}</span>}
          {hasAllergen && (
            <span
              className="chip !border-candy-deep bg-candy/15 !text-[10px] text-candy-deep"
              title={`Contains: ${allergens
                .filter((a) => preferences.allergens.includes(a))
                .join(", ")}`}
            >
              Allergen warning
            </span>
          )}
          {dietMatch && (
            <span className="chip !border-leaf-deep bg-leaf/15 !text-[10px] text-leaf-deep">
              Diet match
            </span>
          )}
        </div>
        <button
          onClick={() => addToCart(p.id, 1, "user")}
          aria-label={`Add ${p.name} to cart`}
          className={`btn-chunky mt-3 w-full text-sm text-white ${
            inCart ? "bg-leaf-deep" : "bg-ink"
          }`}
        >
          {inCart ? "Add another" : "Add to cart"}
        </button>
        {p.productUrl && (
          <a href={p.productUrl} target="_blank" rel="noreferrer" className="merchant-link">
            View live listing <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
