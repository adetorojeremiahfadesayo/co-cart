import { useEffect } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import ProductCard from "./ProductCard";

export default function LiveResults() {
  const domain = useStore((state) => state.domain);
  const products = useStore((state) => state.liveProducts);
  const summary = useStore((state) => state.searchSummary);
  const source = useStore((state) => state.searchSource);
  const continueShopping = useStore((state) => state.continueShopping);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  if (!domain) return null;

  return (
    <main className="results-space">
      <header className="results-intro">
        <div>
          <p className="quiet-kicker">{source === "warmed-snapshot" ? "Verified catalog snapshot" : "Live shortlist"} · {DOMAIN_CONFIG[domain].label}</p>
          <h1>{products.length} current options, with reasons.</h1>
        </div>
        <button type="button" className="quiet-button" onClick={continueShopping}>Choose more <span aria-hidden>+</span></button>
        <p>{summary}</p>
        <div className="live-proof"><span aria-hidden>●</span> {source === "warmed-snapshot" ? "Recent Shopify catalog snapshot. Prices and availability can change at the merchant." : "Sourced live through OpenAI from Shopify Global Catalog. Prices can change at the merchant."}</div>
      </header>
      <section className="live-grid" aria-label="Live Shopify recommendations">
        {products.map((product, index) => (
          <article key={product.id} className="live-result">
            <span className="live-result__rank">{String(index + 1).padStart(2, "0")}</span>
            <ProductCard id={product.id} highlighted={index === 0} />
          </article>
        ))}
      </section>
    </main>
  );
}
