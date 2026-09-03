import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLiveSearch, resetLiveSearchGuardsForTests } from "./liveSearch.js";

const validPayload = {
  domain: "meals",
  answers: {
    meal_type: ["quick dinner"],
    decision_style: ["best value"],
    store_preference: ["no preference"],
    food_priority: ["high protein"],
    budget: ["50"],
    delivery_address: ["12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria"],
  },
};

const shopifyResult = {
  structuredContent: {
    products: [{
      id: "gid://shopify/p/example",
      title: "Verified Shopify Meal",
      description: { plain: "Exact catalog description" },
      media: [{ type: "image", url: "https://cdn.shopify.com/example.jpg" }],
      variants: [{
        id: "gid://shopify/ProductVariant/123",
        url: "https://merchant.example/products/meal",
        checkout_url: "https://merchant.example/cart/123:1",
        price: { amount: 2599, currency: "USD" },
        availability: { available: true },
        seller: { name: "Verified Merchant" },
      }],
    }],
  },
};

const selection = JSON.stringify({
  summary: "One verified option matched the brief.",
  products: [{ sourceId: "gid://shopify/ProductVariant/123", recommendationClass: "Best value", recommendation: "Matches the requested meal intent.", tradeoffs: ["Shipping is separate."], tags: ["quick"] }],
});

function request(payload: unknown = validPayload, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cocart-session": `session${Math.random().toString(36).slice(2)}`, ...headers },
    body: JSON.stringify(payload),
  });
}

function functionCall(name = "shopify_search_catalog") {
  const argumentsByName: Record<string, unknown> = {
    shopify_search_catalog: { query: "quick dinner", address_country: "NG", intent: "high protein quick dinner", max_price_minor: 5000, limit: 6 },
    shopify_get_product: { id: "gid://shopify/ProductVariant/123", address_country: "NG", selected: [] },
  };
  return {
    status: "completed",
    error: null,
    output: [{ type: "function_call", call_id: `call-${name}`, name, arguments: JSON.stringify(argumentsByName[name] ?? {}) }],
  };
}

function finalResponse(output = selection) {
  return { status: "completed", error: null, output_text: output, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: output }] }] };
}

function successfulFetch(output = selection, result: unknown = shopifyResult) {
  let openAiCalls = 0;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === "https://api.openai.com/v1/responses") {
      openAiCalls += 1;
      return new Response(JSON.stringify(openAiCalls === 1 ? functionCall() : finalResponse(output)), { status: 200 });
    }
    if (url === "https://catalog.shopify.com/api/ucp/mcp") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("handleLiveSearch", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalLimit = process.env.COCART_SEARCH_RATE_LIMIT;

  beforeEach(() => {
    resetLiveSearchGuardsForTests();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalLimit === undefined) delete process.env.COCART_SEARCH_RATE_LIMIT;
    else process.env.COCART_SEARCH_RATE_LIMIT = originalLimit;
    vi.restoreAllMocks();
  });

  it("stops with an explicit 503 when the server key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await handleLiveSearch(request());
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("No demo fallback was used");
  });

  it("rejects unknown question ids and option values before calling OpenAI", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await handleLiveSearch(request({ domain: "meals", answers: { meal_style: ["quick"] } }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces the live search function and reconstructs facts from Shopify MCP output", async () => {
    const fetchMock = successfulFetch();
    const response = await handleLiveSearch(request());
    const body = await response.text();
    expect(body).toContain('"type":"result"');
    expect(body).toContain("Verified Shopify Meal");
    expect(body).toContain('"price":25.99');
    expect(body).toContain("Verified Merchant");
    expect(body).toContain('"recommendationClass":"Best value"');
    const firstOpenAiBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstOpenAiBody.tool_choice).toEqual({ type: "function", name: "shopify_search_catalog" });
    expect(firstOpenAiBody.tools.every((tool: { type: string }) => tool.type === "function")).toBe(true);
    expect(firstOpenAiBody.parallel_tool_calls).toBe(false);
    expect(firstOpenAiBody.safety_identifier).toMatch(/^cocart_/);

    const shopifyBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(shopifyBody.method).toBe("tools/call");
    expect(shopifyBody.params.name).toBe("search_catalog");
    expect(shopifyBody.params.arguments.meta["ucp-agent"].profile).toBe("https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json");
    expect(shopifyBody.params.arguments.catalog.filters.available).toBe(true);

    const secondOpenAiBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(secondOpenAiBody.tool_choice).toBe("auto");
    expect(secondOpenAiBody.input.some((item: { type?: string }) => item.type === "function_call_output")).toBe(true);
  });

  it("recovers once when the model completes without the required final shortlist", async () => {
    let openAiCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://api.openai.com/v1/responses") {
        openAiCalls += 1;
        if (openAiCalls === 1) return new Response(JSON.stringify(functionCall()), { status: 200 });
        if (openAiCalls === 2) return new Response(JSON.stringify({ status: "completed", error: null, output: [{ type: "message", role: "assistant", content: [] }] }), { status: 200 });
        return new Response(JSON.stringify(finalResponse()), { status: 200 });
      }
      if (url === "https://catalog.shopify.com/api/ucp/mcp") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: shopifyResult }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const body = await (await handleLiveSearch(request())).text();
    expect(body).toContain('"type":"result"');
    expect(body).toContain("Recovering final shortlist");
    expect(openAiCalls).toBe(3);
    const recoveryRequest = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[3][1]?.body));
    expect(recoveryRequest.tool_choice).toBe("none");
  });

  it("retries one transient upstream fetch failure", async () => {
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://api.openai.com/v1/responses") {
        calls += 1;
        if (calls === 1) throw new TypeError("fetch failed");
        return new Response(JSON.stringify(calls === 2 ? functionCall() : finalResponse()), { status: 200 });
      }
      if (url === "https://catalog.shopify.com/api/ucp/mcp") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: shopifyResult }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const body = await (await handleLiveSearch(request())).text();
    expect(body).toContain('"type":"result"');
    expect(calls).toBe(3);
  });

  it("stops when Shopify MCP rejects the live call", async () => {
    let openAiCalled = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("api.openai.com")) {
        openAiCalled = true;
        return new Response(JSON.stringify(functionCall()), { status: 200 });
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "catalog unavailable" } }), { status: 200 });
    });
    const body = await (await handleLiveSearch(request())).text();
    expect(openAiCalled).toBe(true);
    expect(body).not.toContain('"type":"result"');
    expect(body).toContain("Shopify Global Catalog rejected the call");
    expect(body).not.toContain("Verified Shopify Meal");
  });

  it("requires a successful search_catalog call even if OpenAI asks for another Shopify function", async () => {
    let openAiCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("api.openai.com")) {
        openAiCalls += 1;
        return new Response(JSON.stringify(openAiCalls === 1 ? functionCall("shopify_get_product") : finalResponse()), { status: 200 });
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: shopifyResult }), { status: 200 });
    });
    expect(await (await handleLiveSearch(request())).text()).toContain("No successful Shopify search_catalog call");
  });

  it("rejects malformed agent function arguments before calling Shopify", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "function_call", call_id: "bad-call", name: "shopify_search_catalog", arguments: JSON.stringify({ query: " " }) }] }), { status: 200 }));
    const body = await (await handleLiveSearch(request())).text();
    expect(body).toContain("Invalid catalog query");
  });

  it("rejects cross-origin attempts before spending API tokens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await handleLiveSearch(request(validPayload, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a model selection that is absent from Shopify output", async () => {
    const mismatched = JSON.stringify({ summary: "Mismatch", products: [{ sourceId: "gid://shopify/ProductVariant/999", recommendation: "No", tradeoffs: [], tags: [] }] });
    successfulFetch(mismatched);
    const body = await (await handleLiveSearch(request())).text();
    expect(body).not.toContain('"type":"result"');
    expect(body).toContain("could not be verified");
  });

  it("rate-limits repeated public searches", async () => {
    process.env.COCART_SEARCH_RATE_LIMIT = "1";
    successfulFetch();
    const headers = { "x-cocart-session": "fixedsession123", "x-forwarded-for": "203.0.113.5" };
    await (await handleLiveSearch(request(validPayload, headers))).text();
    const limited = await handleLiveSearch(request(validPayload, headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });
});
