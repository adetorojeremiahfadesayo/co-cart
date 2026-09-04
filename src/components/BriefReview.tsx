import { useEffect, useState } from "react";
import { startGeneralLiveSearch } from "../agent/startDiscovery";
import { DECISION_STYLES, DELIVERY_COUNTRIES, STORE_PREFERENCES } from "../decision/shoppingBrief";
import { useStore } from "../store/useStore";
import type { ShoppingBrief } from "../types";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "JPY"];
const COUNTRY_LABELS: Record<string, string> = { NG: "Nigeria", US: "United States", GB: "United Kingdom", CA: "Canada" };

function listToText(values: string[]) {
  return values.join(", ");
}

function textToList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter((item) => item.length >= 1 && item.length <= 80))].slice(0, 8);
}

export default function BriefReview() {
  const brief = useStore((state) => state.shoppingBrief);
  const reference = useStore((state) => state.discoveryReference);
  const hasQuestions = useStore((state) => state.clarifyingQuestions.length > 0);
  const updateShoppingBrief = useStore((state) => state.updateShoppingBrief);
  const confirmShoppingBrief = useStore((state) => state.confirmShoppingBrief);
  const briefConfirmed = useStore((state) => state.briefConfirmed);
  const returnToEntry = useStore((state) => state.returnToEntry);
  const [searching, setSearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  if (!brief) return null;
  const patch = (value: Partial<ShoppingBrief>) => updateShoppingBrief(value);
  const productTypeValid = brief.productType.trim().length >= 2;
  const destinationValid = Boolean(brief.deliveryCountry);

  const confirmAndSearch = async () => {
    if (!productTypeValid) {
      setLocalError("Give the product type at least two characters.");
      return;
    }
    setLocalError(null);
    if (!destinationValid) {
      setLocalError("Choose the country where the product needs to arrive.");
      return;
    }
    if (!confirmShoppingBrief()) return;
    setSearching(true);
    try {
      await startGeneralLiveSearch();
    } catch {
      setSearching(false); // The search screen presents the actionable error.
    }
  };

  return (
    <main className="decision-space brief-review">
      <header className="decision-space__intro">
        <p className="quiet-kicker">Brief review</p>
        <h1>Confirm what the agent should search for.</h1>
        <p>Everything below is editable. Searching starts only after you confirm.</p>
      </header>

      {reference && (
        <section className="brief-reference" aria-label="How the agent understood your reference">
          <p className="quiet-kicker">
            Interpretation · {reference.mode === "text" ? "your description" : reference.mode === "url" ? "pasted link" : "uploaded photo"}
          </p>
          <h2>“{reference.interpretedProduct}”</h2>
          {reference.visibleAttributes.length > 0 && (
            <ul className="brief-reference__attrs">
              {reference.visibleAttributes.map((attribute) => <li key={attribute}>{attribute}</li>)}
            </ul>
          )}
          {reference.uncertaintyNotes.length > 0 && (
            <p className="brief-reference__uncertain">Not certain about: {reference.uncertaintyNotes.join("; ")}. Correct anything below before searching — the search looks for similar products, not an exact visual match.</p>
          )}
          {reference.sourceUrl && <p className="brief-reference__source">Reference page: {reference.sourceUrl}</p>}
        </section>
      )}

      <div className="decision-stack">
        <section className="decision-step decision-step--answered" aria-labelledby="brief-product-type">
          <div className="decision-step__body brief-fields">
            <label className="brief-field">
              <span id="brief-product-type">Product type</span>
              <input
                type="text"
                className="decision-address-input"
                value={brief.productType}
                maxLength={120}
                onChange={(event) => patch({ productType: event.target.value })}
              />
            </label>
            <label className="brief-field">
              <span>Use case <small>(optional)</small></span>
              <input
                type="text"
                className="decision-address-input"
                value={brief.useCase ?? ""}
                maxLength={200}
                placeholder="What it should help you do"
                onChange={(event) => patch({ useCase: event.target.value.trim() ? event.target.value : undefined })}
              />
            </label>
            <label className="brief-field">
              <span>Priorities <small>(comma separated)</small></span>
              <input
                type="text"
                className="decision-address-input"
                value={listToText(brief.priorities)}
                placeholder="e.g. quiet keys, wireless"
                onChange={(event) => patch({ priorities: textToList(event.target.value) })}
              />
            </label>
            <label className="brief-field">
              <span>Exclusions <small>(comma separated)</small></span>
              <input
                type="text"
                className="decision-address-input"
                value={listToText(brief.exclusions)}
                placeholder="e.g. no leather, no peanuts"
                onChange={(event) => patch({ exclusions: textToList(event.target.value) })}
              />
            </label>
            <div className="brief-field-grid">
              <label className="brief-field">
                <span>Decision style</span>
                <select
                  className="decision-address-input"
                  value={brief.decisionStyle ?? ""}
                  onChange={(event) => patch({ decisionStyle: event.target.value || undefined })}
                >
                  <option value="">No preference</option>
                  {DECISION_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
              </label>
              <label className="brief-field">
                <span>Store preference</span>
                <select
                  className="decision-address-input"
                  value={brief.storePreference ?? ""}
                  onChange={(event) => patch({ storePreference: event.target.value || undefined })}
                >
                  {STORE_PREFERENCES.map((preference) => <option key={preference} value={preference}>{preference}</option>)}
                </select>
              </label>
              <label className="brief-field">
                <span>Budget ceiling <small>(optional)</small></span>
                <span className="brief-field__money">
                  <input
                    type="number"
                    className="decision-address-input"
                    min={1}
                    max={1000000}
                    inputMode="decimal"
                    value={brief.budget?.amount ?? ""}
                    placeholder="No limit"
                    aria-label="Budget amount"
                    onChange={(event) => {
                      const amount = Number(event.target.value);
                      patch({ budget: event.target.value && Number.isFinite(amount) && amount > 0 ? { amount, currency: brief.budget?.currency ?? "USD" } : undefined });
                    }}
                  />
                  <select
                    className="decision-address-input"
                    value={brief.budget?.currency ?? "USD"}
                    aria-label="Budget currency"
                    onChange={(event) => brief.budget && patch({ budget: { ...brief.budget, currency: event.target.value } })}
                  >
                    {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </span>
              </label>
              <label className="brief-field">
                <span>Deliver to <small>(required)</small></span>
                <select
                  className="decision-address-input"
                  value={brief.deliveryCountry ?? ""}
                  onChange={(event) => patch({ deliveryCountry: event.target.value || undefined })}
                >
                  <option value="">Choose destination</option>
                  {DELIVERY_COUNTRIES.map((country) => <option key={country} value={country}>{COUNTRY_LABELS[country]}</option>)}
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>

      {localError && <p className="composer__error" role="alert">{localError}</p>}

      <div className="go-dock">
        <div>
          <strong>{briefConfirmed ? "Brief confirmed." : "Confirm the brief to unlock the live search."}</strong>
          <span>Starts a real OpenAI agent and live Shopify catalog search.</span>
        </div>
        <div className="go-dock__actions">
          {hasQuestions && (
            <button type="button" className="quiet-button" onClick={() => useStore.setState({ stage: "clarifying" })}>Back to answers</button>
          )}
          <button type="button" className="quiet-button" onClick={returnToEntry}>Start over</button>
          <button type="button" className="go-button" disabled={!productTypeValid || !destinationValid || searching} onClick={confirmAndSearch}>
            {searching ? "Starting…" : briefConfirmed ? "Search live catalog" : "Confirm & search"} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
