# Co-Cart Live Agent Workflow — Handoff

Date: 2026-09-01  
Workspace: `C:\Users\adeto\Documents\WEB MCP\co-cart`

Credentialed run evidence: `CO-CART_LIVE_SEARCH_EVIDENCE.md`

## Read this first

The product owner has one non-negotiable rule:

> The normal product experience must use a real agent and live product data. If the agent or live service is unavailable, stop and show an explicit error. Never silently substitute deterministic, seeded, or fabricated recommendations. Deterministic data is allowed only when the owner explicitly asks to preserve a demo.

Do not weaken the server-side MCP-call check, add a seeded fallback, or describe unverified results as live.

Hands-free control is now available globally through an opt-in OpenAI Realtime WebRTC session. The microphone stays off until the shopper starts it. The voice agent reads and changes state only through guarded app tools and uses the same live-only product-search path as the visual UI.

## Intended experience

1. The user chooses one domain card: Meals, Gadgets, or Clothing.
2. The app becomes a quiet white decision space.
3. Decision prompts appear as large cards/sections.
4. A completed decision visually fades but remains in the document, so the user can scroll back and revise it.
5. Go remains disabled until all required decisions have answers.
6. Pressing Go opens a visible agent-search screen.
7. A real OpenAI Responses API agent selects strict Shopify catalog functions; the server validates and executes them against Shopify Global Catalog MCP.
8. Real MCP lifecycle progress is streamed to the UI.
9. The app shows current Shopify products with seller, listed price, image/link when supplied, recommendation reason, and tradeoff.
10. Agent cart changes remain proposals until a human approves them.

## What is implemented

### Integrity hardening completed after review

- A failed, partial, malformed, or unrelated function/MCP result does not count as live evidence.
- The server requires a successful Shopify `search_catalog` JSON-RPC result, injects the required UCP profile itself, and requires a completed OpenAI response.
- Structured model output contains only exact Shopify variant IDs plus recommendation prose. Product title, description, price, currency, merchant, image, listing URL, and checkout URL are reconstructed from completed Shopify tool output.
- Unknown or duplicate variant IDs are rejected. Currency minor units use the currency's actual exponent.
- Server inputs must exactly match the visible decision questions and allowed values.
- Requests are same-origin, rate-limited by IP and browser session, concurrency-capped, limited to six Shopify tool calls, and cancelled after 45 seconds.
- Client searches have abort support and request-generation IDs. Category changes cancel work, and stale results cannot overwrite a newer domain.
- Active product lookup, WebMCP product actions, highlighting, cart actions, and voice lookup are live-only. Static fixtures remain isolated to explicit demo/ranking code.
- Cart totals stay separated by currency. Missing allergen or calorie metadata is reported as unknown rather than safe.
- Voice input is mounted in the header and spoken feedback is session-only; no microphone session or voice preference is persisted.

### Live server path

- `server/liveSearch.ts`
  - Validates the POST body and domain.
  - Reads `OPENAI_API_KEY` only on the server.
  - Uses `OPENAI_MODEL`, defaulting to `gpt-5.6`.
  - Calls `POST https://api.openai.com/v1/responses` with streaming enabled.
  - Gives the model strict function definitions for `shopify_search_catalog`, `shopify_get_product`, and `shopify_lookup_catalog`.
  - Validates model arguments server-side and executes the corresponding JSON-RPC tool against:
    - `https://catalog.shopify.com/api/ucp/mcp`
  - Injects this required UCP profile server-side instead of trusting the model to supply it:
    - `https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json`
  - Requires structured JSON output for the shortlist.
  - Preserves OpenAI output items and encrypted reasoning between stateless (`store: false`) function-call turns.
  - Tracks successful Shopify outputs separately from model-authored content.
  - Rejects the result unless a successful `search_catalog` output can verify every selected variant.
  - Emits simplified NDJSON progress/result/error events to the browser.
  - Returns an explicit 503 when `OPENAI_API_KEY` is absent.

- `netlify/functions/search.ts`
  - Exposes the shared live handler as a Netlify function.

- `netlify.toml`
  - Routes `/api/search` to the Netlify function before the SPA fallback.

- `vite.config.ts`
  - Loads server-only local environment values with `loadEnv`.
  - Provides a development-only `/api/search` middleware so `npm run dev` can test the same handler without exposing the key to the client bundle.

- `.env.example`
  - Documents `OPENAI_API_KEY` and optional `OPENAI_MODEL`.

### Client workflow

- `src/decision/questions.ts`
  - Contains domain-specific decision questions and shared delivery choices.

- `src/agent/liveSearch.ts`
  - Posts the selected domain/answers to `/api/search`.
  - Parses streaming NDJSON status, result, and error events and supports request cancellation.

- `src/components/DecisionDeck.tsx`
  - Renders the scrollable decision sequence.
  - Supports single and two-choice decisions.
  - Visually marks completed sections without reducing text contrast.
  - Enables Go only when every required question is answered.
  - Starts the real live search; no fallback exists in this component.

- `src/components/AgentSearch.tsx`
  - Shows live agent progress.
  - Shows a clear failure state and explicitly says no demo products were substituted.

- `src/components/LiveResults.tsx`
  - Renders the successful live shortlist and source disclosure.

- `src/components/ProductCard.tsx`
  - Supports live currency, seller, image, merchant URL, recommendation, and tradeoff fields.

- `src/App.tsx`
  - Uses the new stages: decisions → searching/error → results.

- `src/store/useStore.ts` and `src/types.ts`
  - Add workflow stage, answers, search events/errors, and live products.
  - Preserve the separate confirmed-cart and proposal architecture.
  - `catalogFor()` now returns live products only in the active flow.
  - Active product lookup is live-only; seeded fixtures cannot enter the cart through WebMCP or UI actions.

### WebMCP surface

`src/webmcp/tools.ts` now registers these 13 tools:

1. `get-decision-state`
2. `select-domain`
3. `set-decision-answer`
4. `start-live-search`
5. `get-live-results`
6. `get-product`
7. `add-to-cart`
8. `remove-from-cart`
9. `swap-item`
10. `get-cart`
11. `check-constraints`
12. `set-preferences`
13. `highlight-products`

The old active deterministic WebMCP tools, `search-products` and `compare-options`, were removed. `start-live-search` drives the same OpenAI → Shopify path used by the visible Go button.

## What was verified

### Local checks

All of these pass:

```text
npm run lint       → pass, no warnings
npm run typecheck  → pass
npm test           → pass, 5 files / 24 tests
npm run build      → pass, production Vite build
```

### Shopify MCP discovery

A direct read-only JSON-RPC `tools/list` request succeeded against Shopify Global Catalog. It returned `search_catalog`, `get_product`, and `lookup_catalog`, including the expected `meta.ucp-agent.profile` input requirement.

### Browser walkthrough

The UI was exercised with Playwright:

- Domain selection works.
- Decision answers persist.
- Two-choice priority selection works.
- Go is disabled until all four questions are complete.
- At 320, 375, 414, and 768 CSS pixels, no horizontal overflow was observed.
- Pressing Go without a server key sends `POST /api/search` and receives HTTP 503.
- The visible page then says:
  - the live search stopped;
  - `OPENAI_API_KEY` is not configured;
  - no demo fallback was used.
- No product results are shown after that failure.

Browser artifact from the mobile check:

- `output/playwright/decision-mobile.png`
- `output/playwright/voice-mobile.png`

## What is not verified yet

There is no `OPENAI_API_KEY` configured in this workspace, so a paid end-to-end OpenAI run has **not** been completed. Do not claim that OpenAI successfully returned live Shopify products until that test is run.

The next agent should treat this as the main blocker, not work around it with sample products.

## Highest-priority next work

### 1. Finish live-result visual coverage across viewports

Create a local `.env` without committing it:

```text
OPENAI_API_KEY=<real server-side key>
OPENAI_MODEL=gpt-5.6
```

Then:

```text
npm run dev
```

Credentialed local runs for meals, clothing, and gadgets were completed on 2026-09-02. All returned HTTP 200 after successful Shopify `search_catalog` calls and produced server-verified live results with no fallback. Exact inputs, timings, progress events, summaries, and returned listings are recorded in `CO-CART_LIVE_SEARCH_EVIDENCE.md`. Unit tests, lint, typecheck, and the production build pass.

A subsequent browser-driven gadget run found and repaired a React Strict Mode blank-results crash. The populated gadget result screen now passes at 1440, 768, 414, 375, and 320 px with no horizontal overflow or broken images. Tablet header wrapping and mobile hands-free-button obstruction were also reduced. See the evidence document for the responsive matrix and exact repair notes.

Future regression runs should confirm from the stream/network response that:

- OpenAI calls the strict `shopify_search_catalog` function.
- The server executes Shopify `search_catalog` through JSON-RPC with the required UCP profile.
- Finalists are verified with `get_product` or `lookup_catalog` when IDs permit.
- Structured output parses successfully.
- Result URLs/images are real and safe HTTP(S) URLs.
- Prices are converted from Shopify minor currency units into major units exactly once.
- A failed/empty search stops cleanly and returns no seeded result.

### 2. Keep the function-call contract covered

The implementation uses non-streaming Responses API turns behind an NDJSON progress stream. It handles:

- `function_call` output items from OpenAI;
- validated Shopify JSON-RPC `tools/call` results;
- `function_call_output` continuation items;
- final structured JSON text from OpenAI;
- API, schema, timeout, and catalog failures.

The mocked contract covers successful calls, Shopify failures, malformed arguments, a missing required search call, provenance mismatches, same-origin enforcement, and rate limiting. The paid gadget run confirmed the real function-call payload end to end.

Official references:

- https://developers.openai.com/api/reference/cli/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/latest-model
- https://shopify.dev/docs/agents/catalog/global-catalog

### 3. Validate the deployed Netlify stream

The production Vite client builds, but the Netlify streaming function has not been exercised on an actual Netlify deployment. Verify:

- `OPENAI_API_KEY` is configured as a Netlify server environment variable.
- `/api/search` reaches `netlify/functions/search.ts`.
- NDJSON chunks are not buffered by the platform/proxy.
- The SPA fallback does not intercept `/api/search`.
- Function timeouts are long enough for the two OpenAI turns plus server-side Shopify MCP calls.

### 4. Remove or quarantine remaining legacy demo code

Static demo catalog and deterministic ranking files still exist for explicit demo tests/history:

- `src/data/products.json`
- `src/data/gadgets.json`
- `src/data/clothing.json`
- `src/data/catalog.ts`
- `src/decision/ranking.ts`
- old unused components such as `DecisionBrief.tsx`, `Shortlist.tsx`, and `ProductGrid.tsx`
- voice input is mounted in the app header on supported browsers; its product lookup is live-only

They are not accepted by the visible recommendation flow, active product lookup, cart actions, highlighting, voice lookup, or WebMCP product tools. They may be deleted later, or retained only as an explicitly owner-authorized demo mode that cannot activate accidentally.

Do not perform this cleanup by breaking the confirmed cart/proposal tests.

### 5. Review cart semantics for live multi-store results

Current semantics:

- Cart and projected totals are grouped by currency and are never silently added together.
- Shopify Global Catalog can return products from different stores, so a single checkout is not implemented.
- The current action is “Confirm plan,” not a real purchase.
- Merchant links are the purchase path for now.
- USD budget comparison pauses for mixed or non-USD listings, and missing safety metadata is reported as unknown.

Do not describe this as Shopify checkout or claim that an order is placed.

### 6. Finish visual and accessibility review on real results

The credentialed API path is verified, but the populated live-results screen still needs visual inspection. Verify real product images and long merchant/product names at:

- 320 px
- 375 px
- 414 px
- 768 px
- desktop

Check image failures, long currencies, long reasons/tradeoffs, focus order, links, cart panel behavior, reduced motion, and no horizontal scrolling.

## Design record

The redesign used the Hallmark guidance already stored in the repo:

- Macrostructure: Narrative Workflow
- Theme: Quiet
- Navigation: N9 edge-aligned minimal
- Footer: Ft2 inline rule
- Enrichment: live Shopify product imagery only

The current CSS stamp is at the top of `src/index.css`, and the run was added to `.hallmark/log.json`.

## Hackathon alignment

The rules review found that WebMCP leverage is the first judging criterion and tie-breaker. Keep the WebMCP tools central to the demo: an evaluator should be able to inspect state, answer decisions, start the live search, inspect live results, and propose cart changes through the page tools while seeing the same state in the UI.

Do not hide the WebMCP layer behind a purely decorative agent animation.

## Working-tree warning

The repository was already heavily modified before this live-agent pass and remains a dirty worktree. Preserve unrelated changes. Review `git diff` by file before deleting or rewriting anything, and do not use destructive reset/checkout commands.

## Definition of done for the next pass

The next pass is complete only when:

- A real OpenAI call succeeds with a captured Shopify MCP tool call.
- Real Shopify results render in the UI.
- Failure paths still show no deterministic fallback.
- Netlify or the intended deployment environment streams correctly.
- Lint, typecheck, tests, and build all pass.
- The remaining issues and any compromises are documented honestly.
