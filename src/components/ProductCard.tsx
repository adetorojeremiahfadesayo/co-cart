import { productById, useStore } from "../store/useStore";

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

  const p = productById(id);
  if (!p) return null;

  const inCart = cart.find((i) => i.productId === id);
  const hasAllergen = preferences.allergens.some((a) => p.allergens.includes(a));
  const dietMatch =
    preferences.diets.length > 0 && preferences.diets.every((d) => p.diets.includes(d));

  return (
    <div
      data-product-id={p.id}
      className={`card-in relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        highlighted ? "agent-highlight border-emerald-400" : "border-stone-200"
      }`}
    >
      <div className="flex h-28 items-center justify-center bg-gradient-to-br from-emerald-50 via-amber-50 to-rose-50 text-6xl select-none">
        {p.emoji}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{p.name}</h3>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            ${p.price.toFixed(2)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-stone-500">{p.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-2 text-[10px] font-medium">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
            {p.kcalPerServing} kcal
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
            {p.proteinG}g protein
          </span>
          {p.prepMinutes > 0 && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
              ⏱ {p.prepMinutes} min
            </span>
          )}
          {hasAllergen && (
            <span
              className="rounded-full bg-red-100 px-2 py-0.5 text-red-700"
              title={`Contains: ${p.allergens
                .filter((a) => preferences.allergens.includes(a))
                .join(", ")}`}
            >
              ⚠ allergen
            </span>
          )}
          {dietMatch && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              ✓ your diet
            </span>
          )}
        </div>
        <button
          onClick={() => addToCart(p.id, 1, "user")}
          aria-label={`Add ${p.name} to cart`}
          className={`mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
            inCart
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-stone-900 text-white hover:bg-stone-700"
          }`}
        >
          {inCart ? `In cart ×${inCart.qty} — add another` : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
