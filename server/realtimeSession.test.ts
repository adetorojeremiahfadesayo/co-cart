import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRealtimeSession, resetRealtimeSessionGuardsForTests } from "./realtimeSession.js";

function request(headers: Record<string, string> = {}, method = "POST") {
  return new Request("http://localhost/api/realtime-session", {
    method,
    headers: { "content-type": "application/json", "x-cocart-session": `voice${Math.random().toString(36).slice(2)}`, ...headers },
    body: method === "POST" ? "{}" : undefined,
  });
}

describe("handleRealtimeSession", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_REALTIME_MODEL;
  const originalLimit = process.env.COCART_REALTIME_RATE_LIMIT;

  beforeEach(() => {
    resetRealtimeSessionGuardsForTests();
    process.env.OPENAI_API_KEY = "server-only-test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_REALTIME_MODEL;
    else process.env.OPENAI_REALTIME_MODEL = originalModel;
    if (originalLimit === undefined) delete process.env.COCART_REALTIME_RATE_LIMIT;
    else process.env.COCART_REALTIME_RATE_LIMIT = originalLimit;
    vi.restoreAllMocks();
  });

  it("stops explicitly when the server key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await handleRealtimeSession(request());
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("OpenAI server key");
  });

  it("rejects unsupported methods and cross-origin requests", async () => {
    expect((await handleRealtimeSession(request({}, "GET"))).status).toBe(405);
    expect((await handleRealtimeSession(request({ origin: "https://attacker.example" }))).status).toBe(403);
  });

  it("creates a scoped Realtime client secret without exposing the server key", async () => {
    process.env.OPENAI_REALTIME_MODEL = "gpt-realtime-test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ value: "ephemeral-secret", expires_at: 1234 }), { status: 200 }));
    const response = await handleRealtimeSession(request({ "x-forwarded-for": "203.0.113.7" }));
    const returned = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(returned).toEqual({ value: "ephemeral-secret", expires_at: 1234, model: "gpt-realtime-test" });
    expect(JSON.stringify(returned)).not.toContain("server-only-test-key");

    const call = fetchMock.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(call[0]).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(headers.authorization).toBe("Bearer server-only-test-key");
    expect(headers["openai-safety-identifier"]).toMatch(/^cocart_[a-f0-9]{48}$/);
    const sent = JSON.parse(String(call[1]?.body));
    expect(sent.session.model).toBe("gpt-realtime-test");
    expect(sent.session.audio.output.voice).toBe("marin");
    expect(sent.session.tools.map((tool: { name: string }) => tool.name)).toContain("start_live_search");
    expect(sent.session.tools.map((tool: { name: string }) => tool.name)).toContain("approve_all_proposals");
  });

  it("does not pass upstream error details to the browser", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("sensitive upstream detail", { status: 400 }));
    const response = await handleRealtimeSession(request());
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(body).not.toContain("sensitive upstream detail");
  });

  it("rate limits repeated session creation", async () => {
    process.env.COCART_REALTIME_RATE_LIMIT = "1";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ value: "ephemeral-secret" }), { status: 200 }));
    const headers = { "x-cocart-session": "fixedvoicesession", "x-forwarded-for": "203.0.113.8" };
    expect((await handleRealtimeSession(request(headers))).status).toBe(200);
    const limited = await handleRealtimeSession(request(headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });
});
