import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { handleVoiceCommand } from "../voice/intents";
import { PushToTalk, recognitionSupported } from "../voice/recognition";
import { ttsSupported } from "../voice/speak";

export default function VoiceControl() {
  const speakProposals = useStore((s) => s.speakProposals);
  const setSpeakProposals = useStore((s) => s.setSpeakProposals);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const ptt = useRef(new PushToTalk());
  const listeningRef = useRef(false);

  const toggle = () => {
    if (listeningRef.current) {
      ptt.current.stop();
      listeningRef.current = false;
      setListening(false);
      return;
    }
    setTranscript("");
    const ok = ptt.current.start({
      onTranscript: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          const result = handleVoiceCommand(text);
          setFeedback(result);
          setTranscript("");
        }
      },
      onEnd: () => {
        listeningRef.current = false;
        setListening(false);
      },
      onError: (msg) => {
        setFeedback(msg);
        listeningRef.current = false;
        setListening(false);
      },
    });
    listeningRef.current = ok;
    setListening(ok);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => ptt.current.stop(), []);

  if (!recognitionSupported() && !ttsSupported()) return null;

  return (
    <div className="flex items-center gap-2">
      {ttsSupported() && (
        <button
          onClick={() => setSpeakProposals(!speakProposals)}
          aria-pressed={speakProposals}
          title="Read agent proposals aloud"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            speakProposals
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          🔊 {speakProposals ? "Speaking" : "Muted"}
        </button>
      )}
      {recognitionSupported() && (
        <div className="relative">
          <button
            onClick={toggle}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Start voice input (Alt+V)"}
            title="Voice commands (Alt+V) — say 'help'"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              listening
                ? "animate-pulse bg-red-500 text-white"
                : "bg-stone-900 text-white hover:bg-stone-700"
            }`}
          >
            {listening ? "● Listening…" : "🎙️ Voice"}
          </button>
          {(transcript || feedback) && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-stone-200 bg-white p-3 text-xs shadow-xl">
              {transcript && (
                <p className="text-stone-500">
                  <span className="font-semibold">Hearing:</span> “{transcript}”
                </p>
              )}
              {feedback && !transcript && (
                <p className="text-stone-700">
                  <span className="font-semibold">Co-Cart:</span> {feedback}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
