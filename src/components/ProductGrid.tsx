import { useEffect, useMemo, useRef } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { filteredProducts, useStore } from "../store/useStore";
import ProductCard from "./ProductCard";

export default function ProductGrid() {
  const domain = useStore((s) => s.domain);
  const filters = useStore((s) => s.filters);
  const highlight = useStore((s) => s.highlight);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const clearHighlight = useStore((s) => s.clearHighlight);

  const categories = domain ? DOMAIN_CONFIG[domain].categories : ["all"];
  const visible = useMemo(() => filteredProducts(filters, domain ?? undefined), [filters, domain]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight || highlight.ids.length === 0) return;
    const el = gridRef.current?.querySelector(`[data-product-id="${highlight.ids[0]}"]`);
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
    <section className="card-soft flex-1 p-4 sm:p-6" aria-label="Products">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter({ category: c, agentFiltered: false })}
              aria-pressed={filters.category === c}
              className={`btn-chunky border-[2.5px] px-3.5 py-1.5 text-xs capitalize shadow-[0_3px_0_rgba(45,27,78,0.9)] ${
                filters.category === c ? "bg-grape text-white" : "bg-white text-ink"
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
          placeholder={domain ? `🔍 Search ${DOMAIN_CONFIG[domain].shortLabel.toLowerCase()}…` : "🔍 Search products…"}
          aria-label="Search products"
          className="w-48 rounded-full border-[2.5px] border-ink/30 bg-white px-4 py-2 text-xs font-bold text-ink outline-none transition focus:border-grape focus:shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
        />
        {filters.agentFiltered && (
          <span className="chip !border-grape-deep bg-grape/15 !text-[11px] text-grape-deep">
            🤖 {filters.note ?? "Filtered by your agent"}
            <button
              onClick={() => {
                clearFilters();
                clearHighlight();
              }}
              aria-label="Clear agent filter"
              className="ml-1 rounded-full px-1 hover:bg-grape/25"
            >
              ✕
            </button>
          </span>
        )}
        {hasActiveFilters && !filters.agentFiltered && (
          <button
            onClick={clearFilters}
            className="btn-chunky border-[2.5px] bg-sun px-3 py-1.5 text-[11px] shadow-[0_3px_0_rgba(45,27,78,0.9)]"
          >
            ✨ Clear filters
          </button>
        )}
        {highlight?.note && (
          <span className="chip !border-leaf-deep bg-leaf/15 !text-[11px] text-leaf-deep">
            ✨ {highlight.note}
            <button onClick={clearHighlight} aria-label="Clear highlight" className="ml-1 rounded-full px-1 hover:bg-leaf/25">✕</button>
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl border-[3px] border-dashed border-ink/30 bg-white/70 p-12 text-center">
          <p className="text-4xl" aria-hidden>🧺</p>
          <p className="mt-2 text-sm font-bold text-ink-soft">
            No products match these filters.{" "}
            <button onClick={clearFilters} className="font-extrabold text-grape-deep underline">
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <div key={p.id}>
              <ProductCard id={p.id} highlighted={highlight?.ids.includes(p.id) ?? false} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
