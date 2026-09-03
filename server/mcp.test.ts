import { afterEach, describe, expect, it } from "vitest";
import { handleMcp } from "./mcp.js";

const originalMcpKey = process.env.COCART_MCP_API_KEY;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

type RpcBody = {
  result?: {
    serverInfo?: { name?: string };
    tools?: { name: string }[];
    isError?: boolean;
    content?: { text: string }[];
  };
  error?: { code: number };
};

function request(method: string, params?: unknown, authorization?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) }),
  });
}

afterEach(() => {
  if (originalMcpKey === undefined) delete process.env.COCART_MCP_API_KEY;
  else process.env.COCART_MCP_API_KEY = originalMcpKey;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
});

describe("Co-Cart MCP endpoint", () => {
  it("publishes protocol metadata and the live catalog tool", async () => {
    const initialized = await handleMcp(request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }));
    expect(initialized.status).toBe(200);
    const initializedBody = await initialized.json() as RpcBody;
    expect(initializedBody.result?.serverInfo?.name).toBe("co-cart");

    const listed = await handleMcp(request("tools/list"));
    const body = await listed.json() as RpcBody;
    expect(body.result?.tools).toHaveLength(1);
    expect(body.result?.tools?.[0].name).toBe("search_live_catalog");
  });

  it("requires a private server-side key before it can spend live-search budget", async () => {
    process.env.COCART_MCP_API_KEY = "test-mcp-key";
    const response = await handleMcp(request("tools/call", { name: "search_live_catalog", arguments: {} }));
    expect(response.status).toBe(401);
    const body = await response.json() as RpcBody;
    expect(body.error?.code).toBe(-32001);
  });

  it("passes an authenticated call to the verified live-search boundary", async () => {
    process.env.COCART_MCP_API_KEY = "test-mcp-key";
    delete process.env.OPENAI_API_KEY;
    const response = await handleMcp(request("tools/call", {
      name: "search_live_catalog",
      arguments: {
        domain: "meals",
        answers: {
          meal_type: ["quick dinner"],
          decision_style: ["crowd favourite"],
          store_preference: ["no preference"],
          food_priority: ["high protein"],
          budget: ["25"],
          delivery_address: ["12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria"],
        },
      },
    }, "Bearer test-mcp-key"));
    expect(response.status).toBe(200);
    const body = await response.json() as RpcBody;
    expect(body.result?.isError).toBe(true);
    expect(body.result?.content?.[0].text).toContain("OPENAI_API_KEY is not configured");
  });
});
