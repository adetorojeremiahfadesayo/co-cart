import { handleLiveSearch } from "./liveSearch.ts";

type JsonObject = Record<string, unknown>;
type McpRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "co-cart", version: "1.0.0" };

const TOOLS = [
  {
    name: "search_live_catalog",
    description: "Search Co-Cart's live Shopify Global Catalog workflow. Provide a complete shopping brief. Co-Cart validates the answers, uses OpenAI tool calling to query Shopify, and returns only server-verified products. Prices exclude shipping and tax.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        domain: { type: "string", enum: ["meals", "gadgets", "clothing"] },
        answers: { type: "object", description: "Complete Co-Cart decision answers for the selected domain. Include delivery_address as one plain-text address." },
      },
      required: ["domain", "answers"],
    },
  },
] as const;

function response(id: unknown, result: JsonObject, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, { status, headers: { "mcp-protocol-version": PROTOCOL_VERSION } });
}

function error(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status, headers: { "mcp-protocol-version": PROTOCOL_VERSION } });
}

function authorized(request: Request) {
  const configured = process.env.COCART_MCP_API_KEY;
  if (!configured) return false;
  return request.headers.get("authorization") === `Bearer ${configured}`;
}

function toolText(payload: unknown, isError = false): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], ...(isError ? { isError: true } : {}) };
}

async function readSearchResult(response: Response): Promise<ToolResult> {
  if (!response.ok || !response.body) return toolText({ error: await response.text() || `Live search failed with HTTP ${response.status}.` }, true);
  const stream = await new Response(response.body).text();
  let result: JsonObject | null = null;
  for (const line of stream.split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as { type?: string; message?: string; summary?: string; products?: unknown[] };
    if (event.type === "error") return toolText({ error: event.message ?? "Live search failed." }, true);
    if (event.type === "result") result = { source: "live Shopify Global Catalog MCP", summary: event.summary, products: event.products };
  }
  return result ? toolText(result) : toolText({ error: "Live search ended without verified products." }, true);
}

async function callTool(params: unknown, request: Request): Promise<ToolResult> {
  if (!params || typeof params !== "object" || Array.isArray(params)) return toolText({ error: "tools/call params must be an object." }, true);
  const { name, arguments: args } = params as { name?: unknown; arguments?: unknown };
  if (name !== "search_live_catalog") return toolText({ error: `Unknown tool: ${String(name)}` }, true);
  if (!args || typeof args !== "object" || Array.isArray(args)) return toolText({ error: "search_live_catalog arguments must be an object." }, true);

  const session = request.headers.get("mcp-session-id")?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || crypto.randomUUID().replaceAll("-", "");
  const liveRequest = new Request(new URL("/api/search", request.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-cocart-session": `mcp-${session}` },
    body: JSON.stringify(args),
  });
  return readSearchResult(await handleLiveSearch(liveRequest));
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  let message: McpRequest;
  try {
    message = await request.json() as McpRequest;
  } catch {
    return error(null, -32700, "Parse error.", 400);
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return error(message.id, -32600, "Invalid JSON-RPC request.", 400);

  if (message.method === "initialize") {
    return response(message.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: "Use tools/list to discover Co-Cart's live shopping tool. Tool calls require Authorization: Bearer <COCART_MCP_API_KEY>.",
    });
  }
  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message.method === "tools/list") return response(message.id, { tools: TOOLS });
  if (message.method === "tools/call") {
    if (!authorized(request)) return error(message.id, -32001, "Unauthorized. Supply Authorization: Bearer <COCART_MCP_API_KEY>.", 401);
    return response(message.id, await callTool(message.params, request));
  }
  return error(message.id, -32601, `Method not found: ${message.method}`);
}
