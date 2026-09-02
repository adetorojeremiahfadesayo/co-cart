import { useStore } from "../store/useStore";
import { formatCurrencyTotals, formatMoney } from "../utils/money";

export default function ConstraintMeter() {
  const preferences = useStore((state) => state.preferences);
  const domain = useStore((state) => state.domain);
  const cartTotals = useStore((state) => state.cartTotals);
  const totals = cartTotals();
  const budget = preferences.weeklyBudget;
  const single = totals.currencyTotals.length === 1 ? totals.currencyTotals[0] : totals.itemCount === 0 ? { currency: "USD", total: 0 } : null;
  const comparable = single?.currency === "USD";
  const percentage = comparable ? Math.min(100, (single.total / Math.max(budget, 1)) * 100) : 0;
  const over = comparable ? single.total > budget : false;

  return (
    <div className="rounded-2xl border-[2.5px] border-ink/20 bg-cream p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-extrabold">
        <span className="text-ink-soft">Listed subtotal</span>
        <span className={over ? "text-candy-deep" : "text-leaf-deep"}>
          {comparable ? `${formatMoney(single.total, single.currency)} / ${formatMoney(budget, "USD")}${over ? " — over" : ""}` : formatCurrencyTotals(totals.currencyTotals)}
        </span>
      </div>
      {comparable ? (
        <div className="h-3.5 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label="USD budget used">
          <div className={`budget-progress ${over ? "bg-candy" : percentage > 80 ? "bg-tang" : "bg-leaf"}`} style={{ transform: `scaleX(${percentage / 100})` }} />
        </div>
      ) : (
        <p className="constraint-note">Budget comparison is paused for mixed or non-USD listings; currencies are never added together.</p>
      )}
      <p className="mt-1.5 text-[11px] font-bold text-ink-soft">
        {domain === "meals" && totals.kcal > 0 ? `About ${totals.kcal.toLocaleString()} kcal across ` : "Confirmed cart · "}
        {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
