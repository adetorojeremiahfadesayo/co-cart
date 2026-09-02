import { useState } from "react";
import { useStore } from "../store/useStore";

export default function ActivityLog() {
  const activity = useStore((s) => s.activity);
  const [open, setOpen] = useState(false);

  return (
    <div className="card-soft overflow-hidden !rounded-3xl">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-extrabold text-ink transition hover:bg-sun/20"
      >
        <span className="font-display">
          📜 Activity log{" "}
          <span className="font-body text-xs font-bold text-ink-soft">
            — every agent action, in the open ({activity.length})
          </span>
        </span>
        <span
          aria-hidden
          className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t-2 border-ink/10 px-5 py-3">
          {activity.length === 0 ? (
            <p className="py-3 text-xs font-bold text-ink-soft">
              Nothing yet. Actions by you and your agent will appear here. 🌱
            </p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {activity.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 py-2 text-xs font-semibold">
                  <span className="shrink-0 tabular-nums text-ink-soft">{e.time}</span>
                  <span
                    className={`chip shrink-0 !text-[10px] ${
                      e.source === "agent"
                        ? "!border-grape-deep bg-grape/15 text-grape-deep"
                        : e.source === "user"
                          ? "!border-sky-700 bg-sky/15 text-sky-700"
                          : "text-ink-soft"
                    }`}
                  >
                    {e.source === "agent" ? "🤖 agent" : e.source === "user" ? "😀 you" : "⚙️ system"}
                  </span>
                  <span className="text-ink">
                    {e.summary}
                    {e.tool && (
                      <code className="ml-1 rounded-md bg-ink/8 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                        {e.tool}
                      </code>
                    )}
                  </span>
                  {e.outcome && <span className={`activity-outcome activity-outcome--${e.outcome}`}>{e.outcome}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
