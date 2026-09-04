import { useStore } from "../store/useStore";
import { cancelActiveInterpretation } from "../agent/startDiscovery";

const MODE_LABEL = {
  text: "Reading your request",
  url: "Inspecting the product link safely",
  image: "Interpreting your reference photo",
} as const;

export default function InterpretingScreen() {
  const mode = useStore((state) => state.discoveryMode) ?? "text";
  const returnToEntry = useStore((state) => state.returnToEntry);
  const cancel = () => {
    cancelActiveInterpretation();
    returnToEntry();
  };

  return (
    <main className="agent-stage" aria-live="polite">
      <div className="agent-orbit" aria-hidden>
        <span className="agent-orbit__core">AI</span>
        <i /><i /><i />
      </div>
      <p className="quiet-kicker">Open product search</p>
      <h1>{MODE_LABEL[mode as keyof typeof MODE_LABEL] ?? MODE_LABEL.text}…</h1>
      <p className="agent-stage__lead">The agent is turning your reference into a shopping brief. You will review it before anything is searched.</p>
      <div className="agent-error__actions">
        <button type="button" className="quiet-button" onClick={cancel}>Cancel</button>
      </div>
    </main>
  );
}
