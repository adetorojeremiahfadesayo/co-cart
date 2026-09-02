import { useState } from "react";
import { ALLERGENS, DIETS, useStore } from "../store/useStore";

export default function PreferenceChips() {
  const preferences = useStore((s) => s.preferences);
  const setPreferences = useStore((s) => s.setPreferences);
  const [open, setOpen] = useState(false);

  const toggle = (list: "allergens" | "diets", value: string) => {
    const cur = preferences[list];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setPreferences({ [list]: next });
  };

  const activeCount = preferences.allergens.length + preferences.diets.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Dietary preferences"
        className="btn-chunky relative border-[2.5px] bg-white px-3 py-1.5 text-xs shadow-[0_3px_0_rgba(45,27,78,0.9)]"
      >
        <span aria-hidden>🥗</span><span className="preference-label">Preferences</span>
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-candy px-1 text-[10px] font-black text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="card-pop pop-in absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] p-4">
          <p className="font-display text-sm font-extrabold">🚫 Avoid allergens</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => (
              <button
                key={a}
                onClick={() => toggle("allergens", a)}
                aria-pressed={preferences.allergens.includes(a)}
                className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-extrabold capitalize transition ${
                  preferences.allergens.includes(a)
                    ? "border-candy-deep bg-candy text-white"
                    : "border-ink/25 bg-white text-ink-soft hover:border-ink/50"
                }`}
              >
                {preferences.allergens.includes(a) ? "🚫 " : ""}
                {a}
              </button>
            ))}
          </div>
          <p className="font-display mt-4 text-sm font-extrabold">🌱 Diets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIETS.map((d) => (
              <button
                key={d}
                onClick={() => toggle("diets", d)}
                aria-pressed={preferences.diets.includes(d)}
                className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-extrabold capitalize transition ${
                  preferences.diets.includes(d)
                    ? "border-leaf-deep bg-leaf text-white"
                    : "border-ink/25 bg-white text-ink-soft hover:border-ink/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="font-display mt-4 block text-sm font-extrabold">
            💰 Weekly budget
            <span className="ml-1.5 rounded-lg border-2 border-ink bg-sun px-1.5 py-0.5 text-xs font-black">
              ${preferences.weeklyBudget.toFixed(0)}
            </span>
          </label>
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={preferences.weeklyBudget}
            onChange={(e) => setPreferences({ weeklyBudget: Number(e.target.value) })}
            aria-label="Weekly budget in dollars"
            className="mt-2 w-full accent-grape"
          />
          <p className="mt-2 text-[11px] font-bold text-ink-soft">
            Saved automatically. Your agent can read and respect these via WebMCP.
          </p>
        </div>
      )}
    </div>
  );
}
