type JsonObject = Record<string, unknown>;

export const SHOPIFY_MCP_URL = "https://catalog.shopify.com/api/ucp/mcp";
export const UCP_AGENT_PROFILE = "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

const MAX_SHOPIFY_RESPONSE_BYTES = 4 * 1024 * 1024;
const supportedCountries = new Set(["NG", "US", "GB", "CA"]);

const nullableInteger = (minimum: number, maximum: number) => ({
  anyOf: [{ type: "integer", minimum, maximum }, { type: "null" }],
});

export const OPENAI_SHOPIFY_FUNCTION_TOOLS = [
  {
    type: "function",
    name: "shopify_search_catalog",
    description: "Search Shopify Global Catalog across merchants. Returns live Shopify product and variant records; use exact returned IDs for the final shortlist.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 2, maxLength: 300 },
        address_country: { type: "string", enum: ["NG", "US", "GB", "CA"] },
        intent: { type: "string", minLength: 1, maxLength: 300 },
        max_price_minor: nullableInteger(1, 100_000_000),
        limit: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["query", "address_country", "intent", "max_price_minor", "limit"],
    },
  },
  {
    type: "function",
    name: "shopify_lookup_catalog",
    description: "Look up live Shopify products or variants by exact IDs returned by an earlier catalog search.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ids: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", minLength: 8, maxLength: 500 } },
        address_country: { type: "string", enum: ["NG", "US", "GB", "CA"] },
      },
      required: ["ids", "address_country"],
    },
  },
  {
    type: "function",
    name: "shopify_get_product",
    description: "Get full live details for one exact Shopify product or variant ID returned by catalog search.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 8, maxLength: 500 },
        address_country: { type: "string", enum: ["NG", "US", "GB", "CA"] },
        selected: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string", maxLength: 100 }, label: { type: "string", maxLength: 200 } },
            required: ["name", "label"],
          },
        },
      },
      required: ["id", "address_country", "selected"],
    },
  },
] as const;

export interface ShopifyAgentToolResult {
  shopifyToolName: "search_catalog" | "lookup_catalog" | "get_product";
  argumentsWithProfile: JsonObject;
  output: string;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function stringValue(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new Error(`Invalid ${field} from the shopping agent.`);
  return value.trim();
}

function countryValue(value: unknown) {
  const country = stringValue(value, "address_country", 2).toUpperCase();
  if (!supportedCountries.has(country)) throw new Error("The shopping agent supplied an unsupported delivery country.");
  return country;
}

function identifier(value: unknown) {
  const id = stringValue(value, "Shopify identifier", 500);
  if (!id.startsWith("gid://shopify/") && !/^https:\/\//i.test(id)) throw new Error("The shopping agent supplied an invalid Shopify identifier.");
  return id;
}

async function callShopify(name: ShopifyAgentToolResult["shopifyToolName"], argumentsWithProfile: JsonObject, signal: AbortSignal) {
  const response = await fetch(SHOPIFY_MCP_URL, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: crypto.randomUUID(), params: { name, arguments: argumentsWithProfile } }),
  });
  if (!response.ok) throw new Error(`Shopify Global Catalog request failed (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SHOPIFY_RESPONSE_BYTES) throw new Error("Shopify Global Catalog returned an oversized response.");
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_SHOPIFY_RESPONSE_BYTES) throw new Error("Shopify Global Catalog returned an oversized response.");
  let payload: JsonObject;
  try {
    payload = JSON.parse(raw) as JsonObject;
  } catch {
    throw new Error("Shopify Global Catalog returned invalid JSON.");
  }
  const rpcError = asObject(payload.error);
  if (rpcError) throw new Error(typeof rpcError.message === "string" ? `Shopify Global Catalog rejected the call: ${rpcError.message}` : "Shopify Global Catalog rejected the call.");
  const result = asObject(payload.result);
  if (!result) throw new Error("Shopify Global Catalog returned no tool result.");
  const structuredContent = asObject(result.structuredContent);
  return JSON.stringify(structuredContent ? { structuredContent } : result);
}

export async function executeShopifyAgentTool(name: string, rawArguments: unknown, signal: AbortSignal): Promise<ShopifyAgentToolResult> {
  const args = asObject(rawArguments);
  if (!args) throw new Error("The shopping agent supplied invalid tool arguments.");
  const meta = { "ucp-agent": { profile: UCP_AGENT_PROFILE } };

  if (name === "shopify_search_catalog") {
    const query = stringValue(args.query, "catalog query", 300);
    const addressCountry = countryValue(args.address_country);
    const intent = stringValue(args.intent, "shopping intent", 300);
    const limit = args.limit;
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 10) throw new Error("Invalid Shopify result limit from the shopping agent.");
    const maxPrice = args.max_price_minor;
    if (maxPrice !== null && (!Number.isSafeInteger(maxPrice) || (maxPrice as number) < 1 || (maxPrice as number) > 100_000_000)) throw new Error("Invalid Shopify price ceiling from the shopping agent.");
    const filters: JsonObject = { available: true, ships_to: { country: addressCountry } };
    if (maxPrice !== null) filters.price = { max: maxPrice };
    const argumentsWithProfile = {
      meta,
      catalog: { query, context: { address_country: addressCountry, intent }, filters, pagination: { limit } },
    };
    return { shopifyToolName: "search_catalog", argumentsWithProfile, output: await callShopify("search_catalog", argumentsWithProfile, signal) };
  }

  if (name === "shopify_lookup_catalog") {
    if (!Array.isArray(args.ids) || args.ids.length < 1 || args.ids.length > 6) throw new Error("The shopping agent must supply between one and six Shopify identifiers.");
    const ids = args.ids.map(identifier);
    const addressCountry = countryValue(args.address_country);
    const argumentsWithProfile = { meta, catalog: { ids, context: { address_country: addressCountry } } };
    return { shopifyToolName: "lookup_catalog", argumentsWithProfile, output: await callShopify("lookup_catalog", argumentsWithProfile, signal) };
  }

  if (name === "shopify_get_product") {
    const id = identifier(args.id);
    const addressCountry = countryValue(args.address_country);
    if (!Array.isArray(args.selected) || args.selected.length > 8) throw new Error("The shopping agent supplied invalid Shopify option selections.");
    const selected = args.selected.map((value) => {
      const option = asObject(value);
      if (!option) throw new Error("The shopping agent supplied an invalid Shopify option selection.");
      return { name: stringValue(option.name, "option name", 100), label: stringValue(option.label, "option label", 200) };
    });
    const argumentsWithProfile = { meta, catalog: { id, selected, context: { address_country: addressCountry } } };
    return { shopifyToolName: "get_product", argumentsWithProfile, output: await callShopify("get_product", argumentsWithProfile, signal) };
  }

  throw new Error(`Unsupported Shopify agent tool: ${name}.`);
}
