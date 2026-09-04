import { useEffect } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import ProductCard from "./ProductCard";

export default function LiveResults() {
  const domain = useStore((state) => state.domain);
  const products = useStore((state) => state.liveProducts);
  const summary = useStore((state) => state.searchSummary);
  const continueShopping = useStore((state) => state.continueShopping);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  if (!domain) return null;

  return (
    <main className="results-space">
      <header className="results-intro">
        <div>
          <p className="quiet-kicker">{DOMAIN_CONFIG[domain].label}</p>
          <h1>{products.length} current options, with reasons.</h1>
        </div>
        <button type="button" className="quiet-button" onClick={continueShopping}>Choose more <span aria-hidden>+</span></button>
        <p>{summary}</p>
      </header>
      <section className="live-grid" aria-label="Live Shopify recommendations">
        {products.map((product, index) => (
          <article key={product.id} className="live-result">
            <span className="live-result__rank">{String(index + 1).padStart(2, "0")}</span>
            <ProductCard id={product.id} highlighted={index === 0} finalPick={index === 0} />
          </article>
        ))}
      </section>
    </main>
  );
}
