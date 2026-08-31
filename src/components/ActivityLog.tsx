import { useState } from "react";
import { useStore } from "../store/useStore";

export default function ActivityLog() {
  const activity = useStore((s) => s.activity);
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-stone-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 sm:px-6"
      >
        <span>
          📜 Activity log{" "}
          <span className="font-normal text-stone-400">
            — every agent action, in the open ({activity.length})
          </span>
        </span>
        <span aria-hidden>{open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-stone-100 px-4 py-2 sm:px-6">
          {activity.length === 0 ? (
            <p className="py-3 text-xs text-stone-400">
              Nothing yet. Actions by you and your agent will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {activity.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 py-1.5 text-xs">
                  <span className="shrink-0 tabular-nums text-stone-400">{e.time}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      e.source === "agent"
                        ? "bg-violet-100 text-violet-700"
                        : e.source === "user"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {e.source === "agent" ? "🤖 agent" : e.source === "user" ? "you" : "system"}
                  </span>
                  <span className="text-stone-700">
                    {e.summary}
                    {e.tool && (
                      <code className="ml-1 rounded bg-stone-100 px-1 text-[10px] text-stone-500">
                        {e.tool}
                      </code>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
