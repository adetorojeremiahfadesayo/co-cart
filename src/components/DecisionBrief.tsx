import { useStore } from "../store/useStore";

const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function DecisionBrief() {
  const brief = useStore((state) => state.brief);
  const updateBrief = useStore((state) => state.updateBrief);
  if (!brief) return null;

  return (
    <section className="brief" aria-labelledby="brief-title">
      <div className="brief__heading">
        <div>
          <h2 id="brief-title">📋 Decision Brief</h2>
          <p>Edit the criteria. The comparison updates deterministically.</p>
        </div>
        <span>🎯 {brief.targetCount} {brief.targetCount === 1 ? "item" : "items"} wanted</span>
      </div>

      <label className="field field--request">
        <span>Request</span>
        <textarea value={brief.request} rows={2} onChange={(event) => updateBrief({ request: event.target.value })} placeholder="Describe the decision in one sentence" />
      </label>

      <div className="brief__criteria">
        <label className="field">
          <span>Required</span>
          <input value={brief.required.join(", ")} onChange={(event) => updateBrief({ required: split(event.target.value) })} placeholder="Comma-separated must-haves" />
        </label>
        <label className="field">
          <span>Preferred</span>
          <input value={brief.preferred.join(", ")} onChange={(event) => updateBrief({ preferred: split(event.target.value) })} placeholder="Comma-separated nice-to-haves" />
        </label>
        <label className="field">
          <span>Budget (USD)</span>
          <input type="number" min="0" inputMode="decimal" value={brief.budget ?? ""} onChange={(event) => updateBrief({ budget: event.target.value ? Number(event.target.value) : undefined })} placeholder="No set budget" />
        </label>
        <label className="field">
          <span>Deal-breakers</span>
          <input value={brief.dealBreakers.join(", ")} onChange={(event) => updateBrief({ dealBreakers: split(event.target.value) })} placeholder="Comma-separated blockers" />
        </label>
        <label className="field">
          <span>Delivery deadline</span>
          <input value={brief.deliveryDeadline ?? ""} onChange={(event) => updateBrief({ deliveryDeadline: event.target.value || undefined })} placeholder="Optional, e.g. Within 5 days" />
        </label>
      </div>
    </section>
  );
}
