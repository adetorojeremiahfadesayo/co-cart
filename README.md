# Co-Cart

Co-Cart is a human-in-the-loop shopping decision assistant for meals, gadgets, and clothing, built for the WebMCP Challenge.

The active workflow is deliberately live-only:

1. Choose a shopping domain.
2. Answer the visible decision cards.
3. Press **Go**.
4. An OpenAI Responses API agent chooses Shopify catalog tools; the server validates and executes those calls against Shopify Global Catalog MCP.
5. Co-Cart streams the agent’s progress, then shows current products, sellers, prices, links, reasons, and tradeoffs.

If the OpenAI key is missing, the agent fails, or Shopify MCP is not called, Co-Cart stops with an explicit error. It does **not** silently substitute seeded products.

Credentialed local searches have passed for meals, clothing, and gadgets. Exact inputs, timing, progress events, and point-in-time Shopify results are recorded in [`CO-CART_LIVE_SEARCH_EVIDENCE.md`](./CO-CART_LIVE_SEARCH_EVIDENCE.md).

## For judges: a 90-second tour

**What it is.** Co-Cart turns an overwhelming catalog into a short, explained shortlist. You answer six plain-language decision cards (including how you want the agent to judge — crowd favourite, best value, hidden gem, or industry standard — and whether you prefer big-name or independent stores). A real OpenAI agent then searches the **live** Shopify Global Catalog, and every product fact you see (title, price, merchant, image, link) is reconstructed server-side from Shopify's own responses — never written by the model.

**Why WebMCP.** The page registers 13 guarded tools (`src/webmcp/tools.ts`) that mirror the visible UI one-to-one: an agent can read the decision state, answer cards, start the live search, read verified results, and propose cart changes. Everything an agent does is visible in the UI as it happens — cards flash and scroll into view when an agent answers them, and cart changes stay proposals until a human approves.

**Try it in 90 seconds:**

1. `npm install`, put an `OPENAI_API_KEY` in `.env` (see `.env.example`), `npm run dev`.
2. Pick a category, answer the cards, press **Go**. Watch the live progress timeline (including how many Shopify listings were found).
3. On the results screen, note the "Agent's pick" badges and honest tradeoffs. Press **Choose more +** to add another product type — results merge live, no duplicates.
4. Open the cart: agent additions arrive as *proposals* with approve/reject — the confirmed cart never changes without you.
5. In a WebMCP-enabled host, call `get-decision-state` and `set-decision-answer` and watch the UI react — the tools are registered silently and nothing about them is shown in the UI.
6. Optional: press **Shop by voice** for the hands-free mode — an OpenAI Realtime agent operates the same tool surface by speech, with the microphone off until you opt in.

**Integrity boundaries worth noticing:** no demo fallback on the live path (a failure shows an explicit, recoverable error), "Top-rated choice" is used only when the listing itself contains rating evidence, prices are labelled as listed prices excluding shipping/tax, and confirming a plan never charges anything — purchase happens at the merchant.

## Architecture

```text
React decision UI / WebMCP page tools
                 ↓
       POST /api/search (server)
                 ↓
       OpenAI Responses API agent
                 ↓ function calls
     validated server-side MCP executor
                 ↓ JSON-RPC
       Shopify Global Catalog MCP
                 ↓
  streamed progress + server-verified shortlist
```

- The OpenAI API key is server-side only.
- Shopify’s public Global Catalog MCP endpoint is fixed by the server; clients cannot supply another MCP URL.
- OpenAI receives only strict Shopify function definitions. The server validates every argument and injects the required UCP agent profile before making Shopify JSON-RPC calls.
- The server requires a successful Shopify `search_catalog` call before accepting a result. Failed, partial, or unrelated tool output does not count.
- The model selects exact Shopify variant IDs. The server reconstructs titles, prices, currencies, merchants, images, and links from completed Shopify tool output instead of trusting model-written product facts.
- Search requests are same-origin, rate-limited per client IP and browser session, concurrency-capped, time-limited, and restricted to six tool calls. Production deployments should retain provider-level rate limits as an additional layer.
- Confirmed cart lines and agent proposals remain separate. Agent add, remove, and swap operations require human approval.

## Run locally

```bash
npm install
copy .env.example .env
# Put a real OPENAI_API_KEY in .env
npm run dev
```

Vite includes a development-only server middleware for `/api/search`, so the API key is never bundled into the browser.

The same middleware also exposes `/api/realtime-session`. That endpoint creates a short-lived OpenAI client secret; the permanent server key is never sent to the browser.

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to Netlify

Set `OPENAI_API_KEY` in the Netlify site environment. `OPENAI_MODEL` is optional and defaults to `gpt-5.6`; `OPENAI_REALTIME_MODEL` defaults to `gpt-realtime-2.1`. `COCART_SEARCH_RATE_LIMIT`, `COCART_MAX_CONCURRENT_SEARCHES`, and `COCART_REALTIME_RATE_LIMIT` override the conservative server defaults. Netlify redirects map both server endpoints to their functions.

Do not create a `VITE_OPENAI_API_KEY`; `VITE_` values are exposed to the client bundle.

## WebMCP tools

The page registers 13 guarded tools against the same visible state:

- `get-decision-state`
- `select-domain`
- `set-decision-answer`
- `start-live-search`
- `get-live-results`
- `get-product`
- `add-to-cart`
- `remove-from-cart`
- `swap-item`
- `get-cart`
- `check-constraints`
- `set-preferences`
- `highlight-products`

The former deterministic `search-products` and `compare-options` tools are not part of the active WebMCP surface.

Static catalog fixtures remain only for isolated ranking tests and an explicitly named demo adapter. Active product lookup, results, WebMCP cart actions, highlighting, and voice lookup accept current `liveProducts` only; there is no automatic demo fallback.

## Hands-free accessibility mode

The **Hands-free mode** button is available on every app screen. It is opt-in and keeps the microphone off until the shopper opens the panel and presses **Start hands-free mode**.

The browser sends live microphone audio directly to an OpenAI Realtime session over WebRTC. The Realtime agent reads the current screen through guarded app tools, speaks the available choices, records exact decision values, starts the same OpenAI → Shopify live-search path as the visual **Go** button, reads verified results, and can create cart proposals. It has no deterministic speech-command or product fallback.

High-impact actions use exact spoken confirmation phrases. Agent cart changes remain pending until `approve all changes`; rejecting all requires `reject all changes`; confirming the internal plan requires `confirm shopping plan`. Plan confirmation never submits payment or places an order. A shopper can interrupt the agent, mute the microphone, repeat the current screen, or end the session.

## Verification boundary

The repository tests mock the OpenAI event stream and prove that failed MCP calls, missing `search_catalog`, mismatched variant IDs, malformed decision answers, mixed currencies, and seeded cart IDs are rejected. A real paid OpenAI → Shopify run and the deployed Netlify stream still require environment credentials and deployment access; do not describe those as exercised until they are captured.

## Stack

Vite · React · TypeScript · Tailwind CSS v4 · Zustand · OpenAI Responses API · Shopify Global Catalog MCP · Netlify Functions
