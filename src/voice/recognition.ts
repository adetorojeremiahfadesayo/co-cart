export type RecognitionCallbacks = {
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

type SpeechRecognitionCtor = new () => any;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return getCtor() != null;
}

export class PushToTalk {
  private rec: any | null = null;

  start(cb: RecognitionCallbacks): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;
    this.stop();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      cb.onTranscript(result[0].transcript, result.isFinal);
    };
    rec.onerror = (e: any) => {
      cb.onError(e?.error === "not-allowed" ? "Microphone access denied." : "Couldn't hear you — try again.");
    };
    rec.onend = () => cb.onEnd();
    this.rec = rec;
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    if (this.rec) {
      try {
        this.rec.onresult = null;
        this.rec.onend = null;
        this.rec.onerror = null;
        this.rec.stop();
      } catch {
        /* ignore */
      }
      this.rec = null;
    }
  }
}
