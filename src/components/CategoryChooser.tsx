import { lazy, Suspense, useState } from "react";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import type { DecisionDomain } from "../types";

const Hero3D = lazy(() => import("./Hero3D"));
const order: DecisionDomain[] = ["meals", "gadgets", "clothing"];

export default function CategoryChooser() {
  const startDomain = useStore((state) => state.startDomain);
  const [choosing, setChoosing] = useState(false);
  const openHandsFree = () => document.getElementById("hands-free-launch")?.click();
  const chooseDomain = (domain: DecisionDomain) => {
    window.scrollTo({ top: 0, behavior: "auto" });
    startDomain(domain, false);
  };

  if (!choosing) {
    return <div className="entry-shell entry-shell--landing">
      <header className="entry-nav">
        <span className="wordmark" aria-label="Co-Cart home">Co<span aria-hidden>-</span>Cart</span>
        <span className="entry-nav__truth"><span aria-hidden>●</span> OpenAI × live Shopify catalog</span>
      </header>
      <main className="landing-main">
        <section className="landing-copy" aria-labelledby="landing-title">
          <p className="quiet-kicker">Shopping, decided together</p>
          <h1 id="landing-title">Tell the agent what you need. <em>It searches live stores.</em></h1>
          <p>Answer a few focused questions. Co-Cart compares current Shopify listings, explains the tradeoffs, and keeps you in control of every cart change.</p>
          <div className="landing-actions">
            <button type="button" className="button button--primary" onClick={() => setChoosing(true)}>Choose a category <span aria-hidden>→</span></button>
            <button type="button" className="button button--secondary" onClick={openHandsFree}><span aria-hidden>◉</span> Shop by voice</button>
          </div>
          <p className="landing-access-note">Hands-free mode can read the screen, listen to your choices, and operate the same live agent flow without a keyboard.</p>
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

  return <div className="entry-shell entry-shell--categories">
    <header className="entry-nav">
      <button type="button" className="wordmark" onClick={() => setChoosing(false)} aria-label="Back to Co-Cart introduction">Co<span aria-hidden>-</span>Cart</button>
      <button type="button" className="button button--secondary button--compact" onClick={() => setChoosing(false)}>← Back</button>
    </header>
    <main id="category-launchpad" className="category-main">
      <header className="category-intro">
        <p className="quiet-kicker">Step 1 of 3</p>
        <h1>What are we shopping for today?</h1>
        <p>Pick one category. The next screen turns your preferences into a brief for the live agent.</p>
      </header>
      <div className="decision-launchpad" aria-label="Shopping categories">
        {order.map((domain, index) => {
          const config = DOMAIN_CONFIG[domain];
          return <button type="button" className={`launch-card launch-card--${domain}`} key={domain} onClick={() => chooseDomain(domain)} style={{ animationDelay: `${index * 70}ms` }}>
            <span className={`launch-card__mark domain-art domain-art--${domain}`} aria-hidden><span>{config.symbol}</span></span>
            <span className="launch-card__copy"><strong>{config.label}</strong><span>{config.outcome}</span></span>
            <span className="launch-card__cta">Choose {config.shortLabel} <span aria-hidden>→</span></span>
          </button>;
        })}
      </div>
    </main>
    <footer className="entry-close"><span>OpenAI finds and ranks the options.</span><span>You make the final decision.</span></footer>
  </div>;
}
