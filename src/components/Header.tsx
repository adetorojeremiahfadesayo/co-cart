import { productById, useStore } from "../store/useStore";
import PreferenceChips from "./PreferenceChips";
import VoiceControl from "./VoiceControl";

export default function Header() {
  const preferences = useStore((s) => s.preferences);
  const cart = useStore((s) => s.cart);

  const active = cart.filter((i) => i.status !== "proposed-removal");
  const itemCount = active.reduce((n, i) => n + i.qty, 0);
  const total = active.reduce(
    (sum, i) => sum + (productById(i.productId)?.price ?? 0) * i.qty,
    0,
  );
  const pendingCount = cart.filter((i) => i.status !== "confirmed").length;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf7f2]/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🛒
          </span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Co-Cart</h1>
            <p className="-mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              agent-native meal-kit store
            </p>
          </div>
        </div>

        {(preferences.allergens.length > 0 || preferences.diets.length > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {preferences.allergens.map((a) => (
              <span
                key={a}
                className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold capitalize text-red-700"
              >
                🚫 {a}
              </span>
            ))}
            {preferences.diets.map((d) => (
              <span
                key={d}
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold capitalize text-emerald-700"
              >
                ✓ {d}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PreferenceChips />
          <VoiceControl />
          <div
            className="hidden items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-bold text-white sm:flex"
            aria-label={`Cart: ${itemCount} items, ${total.toFixed(2)} dollars`}
          >
            🛒 {itemCount} · ${total.toFixed(2)}
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] text-amber-950">
                {pendingCount} new
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
