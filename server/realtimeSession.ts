import { createHash } from "node:crypto";

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 3;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function resetRealtimeSessionGuardsForTests() {
  rateBuckets.clear();
}

const functionTool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "function",
  name,
  description,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  },
});

export const HANDS_FREE_TOOLS = [
  functionTool("read_current_screen", "Read the current Co-Cart screen, its available choices, and what the shopper can do next."),
  functionTool("set_shopping_request", "Submit the shopper's spoken free-form product request for interpretation. Use the shopper's own words; never invent constraints.", {
    request: { type: "string", minLength: 3, maxLength: 500 },
  }, ["request"]),
  functionTool("answer_clarifying_question", "Record the shopper's answer to one currently visible clarifying question. Only use values returned by read_current_screen.", {
    question_id: { type: "string" },
    values: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
  }, ["question_id", "values"]),
  functionTool("confirm_shopping_brief", "Confirm the reviewed shopping brief and start the live search only after the shopper says the exact phrase: confirm brief and search.", {
    confirmation: { type: "string", enum: ["confirm brief and search"] },
  }, ["confirmation"]),
  functionTool("choose_domain", "Choose one guided example journey only after the shopper asks for it.", {
    domain: { type: "string", enum: ["meals", "gadgets", "clothing"] },
  }, ["domain"]),
  functionTool("answer_current_question", "Record one of the options offered for the current decision question. Never invent a value.", {
    question_id: { type: "string" },
    values: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
  }, ["question_id", "values"]),
  functionTool("start_live_search", "Start the OpenAI shopping agent and live Shopify catalog search after every required decision has an answer."),
  functionTool("read_results", "Read the current live Shopify results, including product numbers, merchants, prices, recommendations, and tradeoffs."),
  functionTool("propose_add_to_cart", "Propose adding a live result to the cart. This never changes the confirmed cart until the shopper explicitly approves.", {
    product_id: { type: "string" },
    quantity: { type: "integer", minimum: 1, maximum: 99 },
    reason: { type: "string" },
  }, ["product_id", "quantity", "reason"]),
  functionTool("read_cart", "Read the confirmed cart separately from pending agent proposals."),
  functionTool("approve_all_proposals", "Approve all pending cart proposals only after the shopper says the exact confirmation phrase: approve all changes.", {
    confirmation: { type: "string", enum: ["approve all changes"] },
  }, ["confirmation"]),
  functionTool("reject_all_proposals", "Reject all pending cart proposals only after the shopper says the exact confirmation phrase: reject all changes.", {
    confirmation: { type: "string", enum: ["reject all changes"] },
  }, ["confirmation"]),
  functionTool("confirm_shopping_plan", "Confirm the shopping plan only after the shopper says the exact phrase: confirm shopping plan. This does not place an order or charge money.", {
    confirmation: { type: "string", enum: ["confirm shopping plan"] },
  }, ["confirmation"]),
  functionTool("go_back_to_decisions", "Return from results or an error to the decision questions. Explain that current results and cart work will be cleared before using it.", {
    confirmation: { type: "string", enum: ["go back and clear results"] },
  }, ["confirmation"]),
] as const;

const HANDS_FREE_INSTRUCTIONS = `You are Co-Cart's hands-free shopping guide for blind shoppers and people who cannot reliably use a screen or their hands.

Speak calmly, directly, and in short turns. On entry, call read_current_screen. On the open search screen, begin by asking the shopper: "What are you looking for?" Take their free-form answer and submit it with set_shopping_request. Guided example journeys (meals, gadgets, clothing) are available only if the shopper asks for one. Never claim you can see state that a tool has not returned. After each action, announce what changed and what the next choices are.

After set_shopping_request, read back the interpretation and any uncertainty notes, then ask the visible clarifying questions one at a time, recording each with answer_clarifying_question. Announce every state change. When the brief is ready, summarize it, then ask the shopper to say "confirm brief and search" before calling confirm_shopping_brief. Only consequential confirmations use exact spoken phrases.

All product results come from the OpenAI shopping agent and live Shopify Global Catalog. Never invent products, prices, availability, merchants, recommendations, or fallback results. If a tool fails, say that it stopped and explain the recoverable next step. Long links should be pasted, not dictated. A photo upload needs the visible file picker; do not claim you can select a file yourself.

Only call tools from the shopper's spoken intent. Decision answers must exactly match values returned by read_current_screen. Agent cart actions are proposals, not confirmed changes; never approve your own proposal. Before approve_all_proposals, reject_all_proposals, confirm_shopping_plan, or go_back_to_decisions, explain the effect and ask the shopper to speak the exact confirmation phrase required by the tool. Never purchase, submit payment, or imply an order was placed. A confirmed shopping plan is only a saved confirmation inside Co-Cart.

Do not infer sensitive traits. If speech is unclear or ambiguous, ask one concise clarifying question. The shopper can interrupt you at any time.`;

function numberSetting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function clientIdentity(request: Request) {
  const session = request.headers.get("x-cocart-session")?.trim();
  const safeSession = session && /^[a-zA-Z0-9_-]{8,64}$/.test(session) ? session : "anonymous";
  const forwarded = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = createHash("sha256").update(`${forwarded}:${safeSession}`).digest("hex").slice(0, 48);
  return { rateKeys: [`ip:${forwarded}`, `session:${safeSession}`], safetyIdentifier: `cocart_${digest}` };
}

function takeRateLimit(keys: string[]) {
  const now = Date.now();
  const limit = numberSetting("COCART_REALTIME_RATE_LIMIT", DEFAULT_RATE_LIMIT);
  if (rateBuckets.size > 5_000) {
    for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
  for (const key of keys) {
    const bucket = rateBuckets.get(key);
    if (bucket && bucket.resetAt > now && bucket.count >= limit) {
      return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    }
  }
  for (const key of keys) {
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    else bucket.count += 1;
  }
  return 0;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

export async function handleRealtimeSession(request: Request): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." }, { allow: "POST" });
  if (!isSameOrigin(request)) return json(403, { error: "Cross-origin requests are not allowed." });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json(503, { error: "Hands-free mode is unavailable because the OpenAI server key is not configured." });

  const identity = clientIdentity(request);
  const retryAfter = takeRateLimit(identity.rateKeys);
  if (retryAfter) return json(429, { error: "Too many voice sessions. Please wait before trying again." }, { "retry-after": String(retryAfter) });

  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "openai-safety-identifier": identity.safetyIdentifier,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions: HANDS_FREE_INSTRUCTIONS,
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe" } },
            output: { voice: "marin" },
          },
          tools: HANDS_FREE_TOOLS,
          tool_choice: "auto",
        },
      }),
    });
  } catch {
    return json(502, { error: "OpenAI could not be reached. Hands-free mode did not start." });
  }

  if (!upstream.ok) {
    return json(502, { error: "OpenAI did not create a voice session. Hands-free mode did not start." });
  }

  const payload = await upstream.json() as { value?: unknown; expires_at?: unknown };
  if (typeof payload.value !== "string" || !payload.value) {
    return json(502, { error: "OpenAI returned an invalid voice session. Hands-free mode did not start." });
  }
  return json(200, { value: payload.value, expires_at: payload.expires_at, model });
}
