import { useEffect, useMemo, useRef } from "react";
import {
  CATEGORIES,
  filteredProducts,
  useStore,
} from "../store/useStore";
import ProductCard from "./ProductCard";

export default function ProductGrid() {
  const filters = useStore((s) => s.filters);
  const highlight = useStore((s) => s.highlight);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const clearHighlight = useStore((s) => s.clearHighlight);

  const visible = useMemo(() => filteredProducts(filters), [filters]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to the first highlighted card when the agent highlights products.
  useEffect(() => {
    if (!highlight || highlight.ids.length === 0) return;
    const el = gridRef.current?.querySelector(
      `[data-product-id="${highlight.ids[0]}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  const hasActiveFilters =
    filters.query !== "" ||
    filters.category !== "all" ||
    filters.maxKcal != null ||
    filters.minProtein != null ||
    filters.maxPrice != null ||
    filters.excludeAllergens.length > 0 ||
    filters.diets.length > 0 ||
    filters.tags.length > 0;

  return (
    <section className="flex-1 p-4 sm:p-6" aria-label="Products">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-white">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter({ category: c, agentFiltered: false })}
              aria-pressed={filters.category === c}
              className={`px-3 py-2 text-xs font-semibold capitalize transition ${
                filters.category === c
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilter({ query: e.target.value, agentFiltered: false })}
          placeholder="Search meals…"
          aria-label="Search products"
          className="w-44 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
        />
        {filters.agentFiltered && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
            🤖 {filters.note ?? "Filtered by your agent"}
            <button
              onClick={() => {
                clearFilters();
                clearHighlight();
              }}
              aria-label="Clear agent filter"
              className="ml-1 rounded-full px-1 hover:bg-violet-200"
            >
              ✕
            </button>
          </span>
        )}
        {hasActiveFilters && !filters.agentFiltered && (
          <button
            onClick={clearFilters}
            className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-300"
          >
            Clear filters
          </button>
        )}
        {highlight?.note && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            ✨ {highlight.note}
            <button
              onClick={clearHighlight}
              aria-label="Clear highlight"
              className="ml-1 rounded-full px-1 hover:bg-emerald-200"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No products match these filters.{" "}
          <button onClick={clearFilters} className="font-semibold text-emerald-700 underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              highlighted={highlight?.ids.includes(p.id) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}
