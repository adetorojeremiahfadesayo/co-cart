import { productById, useStore } from "../store/useStore";

export default function ConstraintMeter() {
  const cart = useStore((s) => s.cart);
  const budget = useStore((s) => s.preferences.weeklyBudget);

  const active = cart.filter((i) => i.status !== "proposed-removal");
  const total = active.reduce(
    (sum, i) => sum + (productById(i.productId)?.price ?? 0) * i.qty,
    0,
  );
  const kcal = active.reduce(
    (sum, i) => sum + (productById(i.productId)?.kcalPerServing ?? 0) * i.qty,
    0,
  );
  const itemCount = active.reduce((n, i) => n + i.qty, 0);

  const pct = Math.min(100, (total / Math.max(budget, 1)) * 100);
  const over = total > budget;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-stone-600">Weekly budget</span>
        <span className={over ? "text-red-600" : "text-emerald-700"}>
          ${total.toFixed(2)} / ${budget.toFixed(2)}
          {over ? " — over!" : ""}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Budget used"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            over ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-stone-500">
        ≈ {kcal.toLocaleString()} kcal across {itemCount} item
        {itemCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
