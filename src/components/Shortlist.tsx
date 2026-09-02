import { useMemo, useState } from "react";
import { filteredProducts, useStore } from "../store/useStore";
import { rankProducts, SCORE_FORMULA } from "../decision/ranking";

export default function Shortlist() {
  const domain = useStore((state) => state.domain);
  const brief = useStore((state) => state.brief);
  const filters = useStore((state) => state.filters);
  const addToCart = useStore((state) => state.addToCart);
  const setHighlight = useStore((state) => state.setHighlight);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const options = useMemo(
    () => (domain && brief ? rankProducts(domain, filteredProducts(filters, domain), brief) : []),
    [domain, brief, filters],
  );
  if (!domain || !brief) return null;

  const listedSubtotal = options.reduce((sum, option) => sum + option.product.price, 0);

  return (
    <section className="shortlist" aria-labelledby="shortlist-title">
      <div className="shortlist__heading">
        <div>
          <h2 id="shortlist-title">🏆 Three explainable choices</h2>
          <p>
            Listed subtotal ${listedSubtotal.toFixed(2)} for {options.length === 3 ? "all three" : `${options.length} visible choice${options.length === 1 ? "" : "s"}`} · shipping and tax absent.
          </p>
        </div>
        <button
          className="button button--outline"
          aria-expanded={formulaOpen}
          onClick={() => setFormulaOpen((open) => !open)}
        >
          {formulaOpen ? "🙈 Hide formula" : "🔍 Show formula"}
        </button>
      </div>
      {formulaOpen && <p className="formula-note">{SCORE_FORMULA}</p>}

      <div className="shortlist__grid">
        {options.map((option) => (
          <article className="comparison-card" key={option.product.id}>
            <div className="comparison-card__roles">
              {option.roles.map((role) => <span key={role}>{role}</span>)}
            </div>
            <div className="comparison-card__title">
              <span aria-hidden>{option.product.emoji}</span>
              <div>
                <h3>{option.product.name}</h3>
                <p>{option.product.merchant} · demo listing</p>
              </div>
            </div>
            <div className="comparison-card__price">
              <strong>${option.product.price.toFixed(2)}</strong>
              <span>{option.score}/{option.maxScore} fit points</span>
            </div>
            <dl className="criteria-list">
              {option.results.map((item) => (
                <div key={`${item.kind}-${item.criterion}`}>
                  <dt><span aria-hidden>{item.status === "pass" ? "✓" : item.status === "fail" ? "×" : "?"}</span> {item.criterion}</dt>
                  <dd>{item.detail}</dd>
                </div>
              ))}
            </dl>
            <div className="tradeoff" data-status={option.eligible ? "verified" : "unverified"}>
              <strong>Tradeoff</strong>
              <p>{option.tradeoffs[0]}</p>
            </div>
            <div className="comparison-card__actions">
              <button className="button button--primary" onClick={() => addToCart(option.product.id, 1, "user")}>Add choice</button>
              <button className="button button--quiet" onClick={() => setHighlight([option.product.id], "Review this choice")}>See in catalog</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
