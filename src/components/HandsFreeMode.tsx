import { useEffect, useRef, useState } from "react";
import { CoCartRealtimeAgent } from "../voice/realtimeAgent";
import { executeVoiceTool } from "../voice/tools";
import { OPEN_HANDS_FREE_EVENT } from "../voice/events";

type Status = "idle" | "connecting" | "listening" | "speaking" | "stopped" | "error";
type TranscriptEntry = { id: number; role: "shopper" | "agent"; text: string };

const statusLabel: Record<Status, string> = {
  idle: "Ready to start",
  connecting: "Connecting securely",
  listening: "Listening",
  speaking: "Agent speaking",
  stopped: "Microphone muted",
  error: "Voice session stopped",
};

export default function HandsFreeMode() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState("The microphone stays off until you start.");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const agentRef = useRef<CoCartRealtimeAgent | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const transcriptId = useRef(0);

  useEffect(() => () => agentRef.current?.disconnect(), []);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener(OPEN_HANDS_FREE_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_HANDS_FREE_EVENT, openPanel);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        agentRef.current?.disconnect();
        agentRef.current = null;
        setActive(false);
        setMuted(false);
        setStatus("idle");
        setDetail("The microphone is off. Start again whenever you are ready.");
        setOpen(false);
      }
      if (event.key === "Tab") {
        const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const start = async () => {
    setStatus("connecting");
    setDetail("Creating a secure OpenAI voice session.");
    setTranscript([]);
    setMuted(false);
    const agent = new CoCartRealtimeAgent({
      executeTool: executeVoiceTool,
      onStatus: (nextStatus, nextDetail) => {
        setStatus(nextStatus);
        if (nextDetail) setDetail(nextDetail);
      },
      onTranscript: (role, text) => setTranscript((items) => [...items, { id: ++transcriptId.current, role, text }].slice(-8)),
    });
    agentRef.current = agent;
    try {
      await agent.connect();
      setActive(true);
    } catch (error) {
      setActive(false);
      setStatus("error");
      setDetail(error instanceof Error ? error.message : "Hands-free mode could not start.");
      agentRef.current = null;
    }
  };

  const end = () => {
    agentRef.current?.disconnect();
    agentRef.current = null;
    setActive(false);
    setMuted(false);
    setStatus("idle");
    setDetail("The microphone is off. Start again whenever you are ready.");
  };

  const closePanel = () => {
    if (active) end();
    setOpen(false);
  };

  const toggleMute = () => {
    const agent = agentRef.current;
    if (!agent) return;
    const next = !muted;
    agent.setMuted(next);
    setMuted(next);
  };

  return (
    <>
      <button id="hands-free-launch" type="button" className="hands-free-launch" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Open hands-free voice shopping mode">
        <span className="hands-free-launch__icon" aria-hidden>◉</span>
        <span className="hands-free-launch__tooltip" aria-hidden>Hands-free mode</span>
      </button>

      {open && (
        <div className="hands-free-backdrop" role="presentation" onMouseDown={closePanel}>
          <section ref={panelRef} className="hands-free-panel" role="dialog" aria-modal="true" aria-labelledby="hands-free-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="hands-free-panel__header">
              <div>
                <p className="quiet-kicker">Voice accessibility</p>
                <h2 id="hands-free-title">Shop by speaking</h2>
              </div>
              <button ref={closeRef} type="button" className="hands-free-close" onClick={closePanel} aria-label="Close hands-free mode">×</button>
            </header>

            {!active && status !== "connecting" ? (
              <div className="hands-free-intro">
                <p>The agent reads each screen, listens to your choice, and moves through decisions, live Shopify search, results, and cart proposals with you.</p>
                <ul>
                  <li>Your microphone is used only after you press Start.</li>
                  <li>Audio goes directly to OpenAI for this live session; Co-Cart does not save a recording.</li>
                  <li>Agent cart changes remain proposals until you speak the required approval phrase.</li>
                  <li>Confirming a shopping plan does not buy anything or charge you.</li>
                </ul>
                {status === "error" && <p className="hands-free-error" role="alert">{detail}</p>}
                <button type="button" className="hands-free-primary" onClick={start}>Start hands-free mode</button>
                <p className="hands-free-note">You can interrupt the agent, mute the microphone, or end the session at any time.</p>
              </div>
            ) : (
              <div className="hands-free-session">
                <div className={`hands-free-status hands-free-status--${status}`} role="status" aria-live="polite">
                  <span className="hands-free-status__pulse" aria-hidden />
                  <div><strong>{statusLabel[status]}</strong><p>{detail}</p></div>
                </div>

                <div className="hands-free-transcript" aria-live="polite" aria-label="Recent voice conversation">
                  {transcript.length ? transcript.map((entry) => (
                    <p key={entry.id} className={`hands-free-line hands-free-line--${entry.role}`}>
                      <strong>{entry.role === "agent" ? "Agent" : "You"}</strong>
                      <span>{entry.text}</span>
                    </p>
                  )) : <p className="hands-free-waiting">The agent will begin by reading the current screen.</p>}
                </div>

                <div className="hands-free-actions">
                  <button type="button" className="hands-free-primary" onClick={() => agentRef.current?.requestScreenRead()} disabled={status === "connecting"}>Repeat this screen</button>
                  <button type="button" className="quiet-button" onClick={toggleMute} disabled={status === "connecting"}>{muted ? "Turn microphone on" : "Mute microphone"}</button>
                  <button type="button" className="quiet-button" onClick={end}>End session</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
