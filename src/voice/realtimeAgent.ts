import { getClientSessionId } from "../agent/liveSearch";

type AgentStatus = "connecting" | "listening" | "speaking" | "stopped" | "error";
type TranscriptRole = "shopper" | "agent";

interface RealtimeAgentCallbacks {
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  onStatus: (status: AgentStatus, detail?: string) => void;
  onTranscript: (role: TranscriptRole, text: string) => void;
}

interface SessionSecret {
  value: string;
  model: string;
}

const confirmationPhrases: Record<string, string> = {
  approve_all_proposals: "approve all changes",
  reject_all_proposals: "reject all changes",
  confirm_shopping_plan: "confirm shopping plan",
  go_back_to_decisions: "go back and clear results",
  confirm_shopping_brief: "confirm brief and search",
};

const normalizeSpeech = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function messageFromPayload(payload: unknown, fallback: string) {
  const body = object(payload);
  return typeof body?.error === "string" ? body.error : fallback;
}

export class CoCartRealtimeAgent {
  private callbacks: RealtimeAgentCallbacks;
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private muted = false;
  private handledCalls = new Set<string>();
  private assistantTranscript = "";
  private lastShopperTranscript = "";

  constructor(callbacks: RealtimeAgentCallbacks) {
    this.callbacks = callbacks;
  }

  async connect() {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      throw new Error("This browser does not support the secure microphone connection required for hands-free mode.");
    }
    this.callbacks.onStatus("connecting", "Creating a secure OpenAI voice session.");
    const secretResponse = await fetch("/api/realtime-session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-cocart-session": getClientSessionId() },
      body: "{}",
    });
    const secretPayload = await secretResponse.json().catch(() => null);
    if (!secretResponse.ok) throw new Error(messageFromPayload(secretPayload, "Hands-free mode could not start."));
    const secret = secretPayload as SessionSecret;
    if (!secret.value || !secret.model) throw new Error("The voice session was incomplete.");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.peer = new RTCPeerConnection();
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.peer.ontrack = (event) => {
        if (this.audio) this.audio.srcObject = event.streams[0];
      };
      for (const track of this.stream.getTracks()) this.peer.addTrack(track, this.stream);

      this.channel = this.peer.createDataChannel("oai-events");
      this.channel.addEventListener("message", (event) => void this.handleEvent(event.data));
      this.channel.addEventListener("open", () => {
        this.callbacks.onStatus("listening", "Microphone on. You can interrupt the agent at any time.");
        this.sendUserMessage("Hands-free mode has started. Call read_current_screen now, then guide me through one choice at a time.");
      });
      this.channel.addEventListener("close", () => this.callbacks.onStatus("stopped"));
      this.channel.addEventListener("error", () => this.callbacks.onStatus("error", "The live voice connection failed."));

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      const realtimeResponse = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(secret.model)}`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret.value}`, "content-type": "application/sdp" },
        body: offer.sdp,
      });
      if (!realtimeResponse.ok) throw new Error("OpenAI rejected the live audio connection.");
      await this.peer.setRemoteDescription({ type: "answer", sdp: await realtimeResponse.text() });
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  disconnect() {
    this.channel?.close();
    this.peer?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audio) this.audio.srcObject = null;
    this.channel = null;
    this.peer = null;
    this.stream = null;
    this.audio = null;
    this.handledCalls.clear();
    this.callbacks.onStatus("stopped");
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    this.callbacks.onStatus(muted ? "stopped" : "listening", muted ? "Microphone muted." : "Microphone on.");
  }

  isMuted() {
    return this.muted;
  }

  requestScreenRead() {
    this.sendUserMessage("Read the current screen and the choices I can make next.");
  }

  private send(value: unknown) {
    if (this.channel?.readyState !== "open") throw new Error("The voice agent is not connected.");
    this.channel.send(JSON.stringify(value));
  }

  private sendUserMessage(text: string) {
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    this.send({ type: "response.create" });
  }

  private async handleEvent(raw: string) {
    let event: Record<string, unknown>;
    try {
      const parsed = object(JSON.parse(raw));
      if (!parsed) return;
      event = parsed;
    } catch {
      return;
    }

    const type = typeof event.type === "string" ? event.type : "";
    if (type === "response.output_audio.delta") this.callbacks.onStatus("speaking", "Agent speaking. You can interrupt at any time.");
    if (type === "response.output_audio_transcript.delta" && typeof event.delta === "string") this.assistantTranscript += event.delta;
    if (type === "response.output_audio_transcript.done") {
      const transcript = typeof event.transcript === "string" ? event.transcript : this.assistantTranscript;
      if (transcript.trim()) this.callbacks.onTranscript("agent", transcript.trim());
      this.assistantTranscript = "";
    }
    if (type === "conversation.item.input_audio_transcription.completed" && typeof event.transcript === "string" && event.transcript.trim()) {
      this.lastShopperTranscript = event.transcript.trim();
      this.callbacks.onTranscript("shopper", event.transcript.trim());
    }
    if (type === "response.done") this.callbacks.onStatus(this.muted ? "stopped" : "listening", this.muted ? "Microphone muted." : "Listening for your next choice.");
    if (type === "error") {
      const error = object(event.error);
      this.callbacks.onStatus("error", typeof error?.message === "string" ? error.message : "The OpenAI voice session reported an error.");
    }

    if (type === "response.function_call_arguments.done") {
      await this.handleToolCall(event.call_id, event.name, event.arguments);
    } else if (type === "response.output_item.done") {
      const item = object(event.item);
      if (item?.type === "function_call") await this.handleToolCall(item.call_id, item.name, item.arguments);
    }
  }

  private async handleToolCall(rawCallId: unknown, rawName: unknown, rawArguments: unknown) {
    if (typeof rawCallId !== "string" || typeof rawName !== "string" || this.handledCalls.has(rawCallId)) return;
    this.handledCalls.add(rawCallId);
    let args: Record<string, unknown> = {};
    try {
      if (typeof rawArguments === "string" && rawArguments) args = object(JSON.parse(rawArguments)) ?? {};
      const requiredPhrase = confirmationPhrases[rawName];
      if (requiredPhrase && normalizeSpeech(this.lastShopperTranscript) !== requiredPhrase) {
        throw new Error(`The shopper must speak the exact confirmation phrase: ${requiredPhrase}.`);
      }
      if (requiredPhrase) this.lastShopperTranscript = "";
      const output = await this.callbacks.executeTool(rawName, args);
      this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: rawCallId, output: JSON.stringify(output) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: rawCallId, output: JSON.stringify({ ok: false, error: message }) } });
    }
    this.send({ type: "response.create" });
  }
}
