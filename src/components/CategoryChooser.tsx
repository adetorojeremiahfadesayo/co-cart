import { lazy, Suspense } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import type { DecisionDomain } from "../types";
import DiscoveryComposer from "./DiscoveryComposer";
import { startTextDiscovery, startUrlDiscovery } from "../agent/startDiscovery";

const Hero3D = lazy(() => import("./Hero3D"));

const EXAMPLES: Array<{ domain: Exclude<DecisionDomain, "general">; journey: string }> = [
  { domain: "meals", journey: "Plan a quick dinner" },
  { domain: "gadgets", journey: "Compare wireless headphones" },
  { domain: "clothing", journey: "Find a complete outfit" },
];

export default function CategoryChooser() {
  const startDomain = useStore((state) => state.startDomain);
  const interpretationError = useStore((state) => state.interpretationError);
  const pendingRequest = useStore((state) => state.pendingRequest);
  const openHandsFree = () => document.getElementById("hands-free-launch")?.click();

  const retry = () => {
    if (!pendingRequest) return;
    if (pendingRequest.mode === "text" && pendingRequest.text) startTextDiscovery(pendingRequest.text).catch(() => { /* error resurfaces here */ });
    if (pendingRequest.mode === "url" && pendingRequest.url) startUrlDiscovery(pendingRequest.url).catch(() => { /* error resurfaces here */ });
  };

  return <div className="entry-shell entry-shell--landing">
    <header className="entry-nav">
      <span className="wordmark" aria-label="Co-Cart home">Co<span aria-hidden>-</span>Cart</span>
      <span className="entry-nav__truth"><span aria-hidden>●</span> OpenAI × live Shopify catalog</span>
    </header>
    <main className="landing-main">
      <section className="landing-copy" aria-labelledby="landing-title">
        <p className="quiet-kicker">Shopping, decided together</p>
        <h1 id="landing-title">What are you <em>looking for?</em></h1>
        <p>Describe any product, upload a photo, or paste a link. Co-Cart interprets your request, asks only what is missing, compares real Shopify listings, and keeps every cart change under your approval.</p>

        <DiscoveryComposer />

        {interpretationError && (
          <div className="composer__error composer__error--banner" role="alert">
            <p>{interpretationError}</p>
            {pendingRequest && pendingRequest.mode !== "image" && (
              <button type="button" className="quiet-button" onClick={retry}>Retry the same request</button>
            )}
            {pendingRequest?.mode === "image" && <span>Choose the photo again to retry.</span>}
          </div>
        )}

        <div className="landing-actions">
          <button type="button" className="button button--secondary" onClick={openHandsFree}><span aria-hidden>◉</span> Shop by voice</button>
        </div>
        <p className="landing-access-note">Hands-free mode starts with the same open question, reads the screen, listens to your choices, and operates the same live agent flow without a keyboard.</p>

        <section className="example-strip" aria-labelledby="example-strip-title">
          <h2 id="example-strip-title">Try an example</h2>
          <p className="example-strip__note">Guided journeys that show how Co-Cart works — examples, not the limit of what you can search.</p>
          <div className="example-strip__cards">
            {EXAMPLES.map((example, index) => {
              const config = DOMAIN_CONFIG[example.domain];
              return <button
                type="button"
                className="example-card"
                key={example.domain}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "auto" });
                  startDomain(example.domain, false);
                }}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className={`example-card__mark domain-art domain-art--${example.domain}`} aria-hidden><span>{config.symbol}</span></span>
                <span className="example-card__copy"><strong>{example.journey}</strong><span>{config.label}</span></span>
                <span className="example-card__cta" aria-hidden>→</span>
              </button>;
            })}
          </div>
        </section>
      </section>
      <div className="landing-art">
        <Suspense fallback={<div className="hero-bag-fallback" aria-hidden><span>Co</span></div>}><Hero3D /></Suspense>
      </div>
    </main>
    <footer className="entry-close entry-close--landing">
      <span>Live recommendations · Real merchant listings · You approve cart changes</span>
      <span>Checkout opens with the relevant merchant</span>
    </footer>
  </div>;
}
