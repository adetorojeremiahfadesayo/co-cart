import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";
import { cancelActiveSearch } from "../agent/searchCoordinator";

export default function AgentSearch() {
  const domain = useStore((state) => state.domain);
  const stage = useStore((state) => state.stage);
  const events = useStore((state) => state.searchEvents);
  const error = useStore((state) => state.searchError);
  const returnToDecisions = useStore((state) => state.returnToDecisions);

  if (!domain) return null;
  const failed = stage === "error";
  const backToDecisions = () => {
    cancelActiveSearch();
    returnToDecisions();
  };

  return (
    <main className="agent-stage" aria-live="polite">
      <div className={`agent-orbit ${failed ? "agent-orbit--failed" : ""}`} aria-hidden>
        <span className="agent-orbit__core">AI</span>
        {!failed && <><i /><i /><i /></>}
      </div>
      <p className="quiet-kicker">OpenAI × Shopify Global Catalog</p>
      <h1>{failed ? "The live search stopped." : `Searching for your ${DOMAIN_CONFIG[domain].shortLabel.toLowerCase()}…`}</h1>
      <p className="agent-stage__lead">
        {failed ? "Co-Cart did not substitute demo products." : "The agent is checking current listings, merchants, prices, and tradeoffs."}
      </p>

      <ol className="agent-timeline">
        {events.map((event) => (
          <li key={event.id} className={`agent-event agent-event--${event.status}`}>
            <span aria-hidden>{event.status === "done" ? "✓" : event.status === "error" ? "!" : "·"}</span>
            <div><strong>{event.label}</strong>{event.detail && <small>{event.detail}</small>}</div>
          </li>
        ))}
      </ol>

      {failed && (
        <div className="agent-error" role="alert">
          <p>{error}</p>
          <button type="button" className="quiet-button" onClick={backToDecisions}>Back to decisions</button>
        </div>
      )}
    </main>
  );
}
