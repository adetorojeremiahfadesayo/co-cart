import { useState } from "react";
import { ALLERGENS, DIETS, useStore } from "../store/useStore";

export default function PreferenceChips() {
  const preferences = useStore((s) => s.preferences);
  const setPreferences = useStore((s) => s.setPreferences);
  const log = useStore((s) => s.log);
  const [open, setOpen] = useState(false);

  const toggle = (list: "allergens" | "diets", value: string) => {
    const cur = preferences[list];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setPreferences({ [list]: next });
    log("user", `${cur.includes(value) ? "Removed" : "Added"} ${list === "allergens" ? "allergen" : "diet"}: ${value}`);
  };

  const activeCount = preferences.allergens.length + preferences.diets.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Dietary preferences"
        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
      >
        🥗 Preferences
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
          <p className="text-xs font-bold text-stone-800">Avoid allergens</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => (
              <button
                key={a}
                onClick={() => toggle("allergens", a)}
                aria-pressed={preferences.allergens.includes(a)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                  preferences.allergens.includes(a)
                    ? "bg-red-100 text-red-800 ring-1 ring-red-300"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {preferences.allergens.includes(a) ? "🚫 " : ""}
                {a}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-stone-800">Diets</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DIETS.map((d) => (
              <button
                key={d}
                onClick={() => toggle("diets", d)}
                aria-pressed={preferences.diets.includes(d)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                  preferences.diets.includes(d)
                    ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-bold text-stone-800">
            Weekly budget
            <span className="ml-1 font-normal text-stone-500">
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
            className="mt-1 w-full accent-emerald-600"
          />
          <p className="mt-2 text-[11px] text-stone-400">
            Saved automatically. Your agent can read and respect these via WebMCP.
          </p>
        </div>
      )}
    </div>
  );
}
