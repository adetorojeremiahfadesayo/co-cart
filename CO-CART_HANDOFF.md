# Co-Cart Multi-Domain Decision Assistant — Handoff

**Handoff date:** 2026-09-01 (Africa/Lagos)  
**Repository:** `C:\Users\adeto\Documents\WEB MCP\co-cart`  
**Branch / HEAD at handoff:** `main` / `c13d18a`  
**Status update (2026-09-01):** the compatibility breakage and review findings described below have now been repaired. The confirmed-cart/proposal split remains intact; focused tests, responsive/accessibility fixes, and current verification results are recorded in `CO-CART_REVIEW.md`. Historical "paused" and "unverified" notes below describe the earlier handoff state and are retained as context.

**Status update (2026-09-02 — hands-free accessibility build):** Co-Cart now has a global, opt-in **Hands-free mode** powered by an OpenAI Realtime voice agent over WebRTC. The microphone remains off until the shopper explicitly starts a session. A server endpoint creates short-lived client secrets; the permanent OpenAI key remains server-side. The agent reads current UI state through guarded functions, speaks numbered choices, records only exact offered decision values, invokes the same OpenAI → live Shopify search path as the visual Go button, reads verified results, and creates cart proposals. Approval, rejection, clearing results, and internal plan confirmation require exact spoken confirmation phrases. There is no deterministic speech-command or product fallback on the active path. The older `VoiceControl.tsx` and deterministic intent files remain in the repository only as unmounted legacy code pending an explicit cleanup decision.

**Status update (2026-09-02 — credentialed live-search repair):** The OpenAI key, Realtime client-secret endpoint, and Shopify Global Catalog MCP endpoint were verified. OpenAI's hosted remote-MCP request to Shopify returned HTTP 424, so the active search path now exposes strict Shopify function tools to the OpenAI Responses agent and executes the selected tools through a validated, server-side Shopify MCP JSON-RPC client. The agent is still responsible for search/tool choice and final selection; there is no deterministic recommendation or product fallback. Paid local runs completed for meals, clothing, and gadgets with HTTP 200 and server-verified live results. Exact evidence is in `CO-CART_LIVE_SEARCH_EVIDENCE.md`. Unit tests, lint, typecheck, and the production build pass.

**Status update (2026-09-02 — populated-results browser pass):** A browser-driven gadget search exposed and repaired a React Strict Mode blank-screen crash in `LiveResults`. Real result cards now render successfully. Responsive inspection passed at 1440, 768, 414, 375, and 320 px with no horizontal overflow or broken images. The tablet header and fixed hands-free control were compacted to avoid wrapping and excessive content obstruction. The 320 px hands-free dialog layout also passed without activating the microphone. Details and remaining checks are in `CO-CART_LIVE_SEARCH_EVIDENCE.md`.

New/updated hands-free files:

- `server/realtimeSession.ts` and `netlify/functions/realtime-session.ts`
- `src/voice/realtimeAgent.ts` and `src/voice/tools.ts`
- `src/components/HandsFreeMode.tsx`
- `src/agent/startCurrentSearch.ts`
- `src/App.tsx`, `src/components/Header.tsx`, `src/components/DecisionDeck.tsx`
- `vite.config.ts`, `netlify.toml`, `.env.example`, `README.md`, and `src/index.css`

The historical deterministic demo/ranking sections below are retained for provenance. They do not describe the active recommendation or hands-free workflow.

## 1. Original objective

Evolve the existing grocery-only WebMCP demo into a coherent first release of a human-in-the-loop shopping decision assistant for categories with choice overload, while preserving the working grocery scenario and avoiding a destructive rewrite.

Product positioning supplied by the user:

> Co-Cart turns too many options into three explainable choices—personalized by your needs, compared across merchants, and approved by you.

Target audience: everyday shoppers overwhelmed by too many options.  
Primary action: choose a shopping category and launch a guided comparison.  
Tone: playful but trustworthy.  
Live-data direction: Shopify-first but platform-expandable, with a reliable deterministic demo fallback. Do not call the product “Shopify native.” “Shopify-powered” is only truthful when real Shopify data is active.

Required categories and preset demos:

- Meals & Nutrition — “Find three dinners under 400 calories, peanut-free, ready in 30 minutes, below $60.”
- Gadgets — “Find noise-cancelling headphones under $200 with long battery life and the best available price.”
- Clothing & Style — “Build a breathable outfit for an outdoor wedding, size medium, below $150.”

The original grocery hero experience, WebMCP tools, visible activity log, voice support, and hard human checkout approval gate must remain functional.

## 2. Pre-edit inspection and baseline

- No applicable `AGENTS.md` was found under `C:\Users\adeto\Documents\WEB MCP`.
- Read `C:\Users\adeto\.codex\skills\hallmark\SKILL.md` completely, plus relevant playful/workbench design references.
- Read the existing repository, `README.md`, and `C:\Users\adeto\Documents\WEB MCP\CO-CART_PRD_AND_PLAN.md`.
- Initial git status was clean.
- Baseline framework: Vite 8, React 19, TypeScript 6, Tailwind CSS 4, Zustand 5; no motion library, no existing Hallmark project memory, and no locked `design.md`.
- Baseline checks before any edits all passed:
  - `npm run lint` — exit 0.
  - `npx tsc -b --pretty false` — exit 0.
  - `npm run build` — exit 0; Vite produced the production bundle successfully.

Hallmark direction chosen and disclosed:

- Genre: playful.
- Macrostructure: Workbench.
- Theme: Plume, adapted to preserve the warm Co-Cart identity.
- Navigation: N7 Brutal slab.
- Closing treatment: Ft5 Statement.
- Enrichment: typography and existing product art only; no invented merchant photography.

## 3. Completed work

### Domain and product model

- Replaced the meal-only type model with a generic `DecisionDomain` model covering `meals`, `gadgets`, and `clothing`.
- Added typed data-source status and adapter contracts.
- Added a generic product shape with domain-specific optional attributes for nutrition, headphone specifications, clothing fit/materials, delivery, merchant, and clearly marked demo provenance.
- Preserved the original 48-meal JSON catalog. Meal rows are normalized at runtime with a domain, illustrative demo merchant, demo status, and deterministic delivery estimate.
- Added eight realistic demo headphone rows with battery, ANC, weight, codec, merchant, and delivery fields.
- Added eight realistic demo outfit rows with size availability, materials, breathability, formality, pieces, merchant, and delivery fields.
- Added category configuration and all three required preset briefs.
- Added an explicit demo-data status and an explicit “Live data not connected” Shopify status. No fictional value is presented as live by the new model.

### Decision brief and deterministic ranking

- Added typed editable `DecisionBrief` fields: request, required, preferred, budget, deal-breakers, delivery deadline, and target count.
- Added deterministic criterion evaluation for the seeded meal, gadget, and clothing attributes.
- Added inspectable point scoring (not percentages):
  - required +30 each;
  - preferred +10 each;
  - budget +20;
  - delivery +10;
  - deal-breaker clearance +35 each;
  - failed required/deal-breaker criteria rank behind eligible candidates;
  - deterministic tie-break by listed price then product id.
- Unknown/custom criteria are labelled “Not verifiable from the available demo fields” instead of being guessed.
- Added three-option role assignment: Best overall match, Lowest listed price, Best alternative, with a Close contender fallback if one option holds more than one role.
- Every generated price explanation says “listed,” names the demo merchant, and states that shipping and tax are absent.

### Approval-state architecture

- Split confirmed cart lines and agent proposals into independent state collections.
- Added a pure proposal state-machine module for add, remove, swap, approve, and reject.
- Agent additions to an existing confirmed line are now independent proposals. Rejecting them cannot remove the user's confirmed quantity.
- Agent removals always create a proposal for any confirmed line, regardless of who originally added it.
- Agent swaps leave the original confirmed product untouched until approval. Rejecting a swap leaves the original intact.
- Added projected-cart calculation for constraint checks without prematurely mutating confirmed state.

### Zustand store refactor

- Added active domain and editable brief state.
- Added domain start/reset actions, domain-aware filters/catalog lookup, independent confirmed cart/proposal actions, projected totals, and generic constraints.
- Preserved persisted meal preferences and speech setting.
- Store-level agent tool logging was intentionally removed so the WebMCP wrapper can own exactly one activity record per tool invocation.

### WebMCP refactor (implemented but unverified)

- Added one audited execution boundary intended to log each tool invocation once, including read tools and failures.
- Added category-aware `get-decision-state`, `set-decision-brief`, and `compare-options` tools.
- Generalized search and product detail to the active category.
- Kept compatibility tools `add-to-cart`, `remove-from-cart`, `swap-item`, `get-cart`, `check-constraints`, `set-preferences`, `highlight-products`, and `checkout`.
- Updated cart payloads to distinguish confirmed state, pending proposals, confirmed listed subtotal, and projected listed subtotal.
- Updated tool copy to be explicit about demo data, listed prices, absent shipping/tax, category boundaries, and human approval.
- Checkout remains a hard gate when any proposal exists.

### New UI components (created but not wired)

- Added a deliberate category entry/launchpad with the three required cards and single-line “Try this demo” buttons.
- Added “Start with my own request” category controls that create a blank brief.
- Added a visible Demo data / Live data not connected status.
- Added a compact editable Decision Brief component.
- Added a three-option comparison component with role labels, fit points, requirement-by-requirement results, tradeoffs, formula disclosure, honest listed price language, and add/highlight actions.

## 4. Exact files changed or created

Modified:

- `src/types.ts`
- `src/store/useStore.ts`
- `src/webmcp/tools.ts`

Created:

- `src/components/CategoryChooser.tsx`
- `src/components/DataSourceStatus.tsx`
- `src/components/DecisionBrief.tsx`
- `src/components/Shortlist.tsx`
- `src/data/catalog.ts`
- `src/data/gadgets.json`
- `src/data/clothing.json`
- `src/decision/ranking.ts`
- `src/store/proposalState.ts`
- `CO-CART_HANDOFF.md` (this document)

No production file was deleted. `src/data/products.json` was not modified.

## 5. Current git status at the pause boundary

Snapshot before adding this handoff file:

```text
 M src/store/useStore.ts
 M src/types.ts
 M src/webmcp/tools.ts
?? src/components/CategoryChooser.tsx
?? src/components/DataSourceStatus.tsx
?? src/components/DecisionBrief.tsx
?? src/components/Shortlist.tsx
?? src/data/catalog.ts
?? src/data/clothing.json
?? src/data/gadgets.json
?? src/decision/
?? src/store/proposalState.ts
```

`CO-CART_HANDOFF.md` is additionally untracked after this document is written.

Diff stat before this handoff document:

```text
src/store/useStore.ts | 542 lines changed
src/types.ts          | 120 lines changed
src/webmcp/tools.ts   | 376 lines changed
3 tracked files: 415 insertions, 623 deletions
```

Git reports LF→CRLF warnings for the three modified tracked TypeScript files. This is informational; no line-ending normalization was attempted.

## 6. Important architecture decisions

### Confirmed state and proposals are separate

This is the most important safety decision. Do not collapse them back into one line with a mutable `status`. The old representation caused the critical integrity bugs. A proposal is a first-class command record; approval applies it to confirmed state, rejection drops only that command.

### One activity record per WebMCP execution

Agent actions in the store should not log tool names. The `audited()` wrapper in `src/webmcp/tools.ts` is intended to create exactly one agent activity entry per invocation. Human UI actions can still log in the store.

### Decision domains, not meal-specific UI state

The active domain owns its catalog, category labels, brief, shortlist, cart, and proposals. Category switching must explicitly reset or confirm reset when meaningful state exists. Do not mix carts across domains.

### Demo adapter first

`CatalogAdapter` and explicit source status exist so a future live adapter can be added without changing decision logic or UI contracts. The seeded adapter must remain the deterministic fallback.

### Honest ranking and price language

Scores are points from a visible formula, never invented fit percentages. “Lowest listed price” is scoped to the compared demo listings. Do not claim final cheapest price without shipping/tax and verified live offers.

## 7. Known incomplete or broken areas

**The application is expected not to type-check in its current state. This was not verified after the refactor because the user requested an immediate safe stop.**

The main known issue is that the old app shell and existing components still consume the old cart model:

- `src/App.tsx` does not render `CategoryChooser`, `DecisionBrief`, or `Shortlist`.
- `src/App.tsx` proposal speech still reads `cart.status`, `swappedFromId`, and related removed fields.
- `src/components/CartPanel.tsx`, `CartItemRow.tsx`, `Header.tsx`, `ConstraintMeter.tsx`, and `CheckoutConfirmation.tsx` still expect proposals embedded in `cart` and old store actions such as `approveItem` / `rejectItem`.
- `src/voice/intents.ts` still expects the old embedded proposal/status model and meal-only category constants.
- `src/components/ProductGrid.tsx` and `ProductCard.tsx` still assume meal-only fields and old category exports.
- `src/components/PreferenceChips.tsx` may double-log preference edits unless adjusted to the new `setPreferences` source handling.
- `src/components/ActivityLog.tsx` does not yet render the new `outcome` field.
- `src/components/WebMcpBanner.tsx` still describes the old meal store wording.
- New components have semantic class names, but the required styles do not exist yet.
- `tokens.css`, the Hallmark CSS stamp, `.hallmark/preflight.json`, and `.hallmark/log.json` have not been created.
- Responsive/mobile behavior at 320, 375, 414, and 768 px has not been implemented or verified.
- Focus-visible, reduced-motion, 44 px touch targets, and no-two-line primary button requirements have not been verified in the new UI.
- The category reset confirmation/safe switch control has not been wired.
- Batch proposal speech is not fixed yet. It must debounce proposal additions and announce the completed pending batch, not only the first sequential add.
- The ranking logic and proposal state machine have no automated tests yet.
- Vitest is not installed and `package.json` / `package-lock.json` are unchanged.
- README and PRD status are unchanged.
- No current lint/typecheck/test/build has been run after edits.
- No browser flow has been exercised for any category after edits.

### Ranking details to inspect

- The deal-breaker evaluators intentionally treat a product as passing when it clears the blocker, but the wording paths should receive focused tests.
- With arbitrary custom briefs, one product can hold both Best overall and Lowest listed price. The UI then uses “Close contender” for the otherwise unlabeled third option. Verify this interaction and copy.
- Meal budget scoring divides a total target by `targetCount`; the comparison separately shows the subtotal of all three options. Add tests for the required grocery preset and verify the chosen three total below $60.

### Store/WebMCP details to inspect

- Verify `projectedCart()` applies a sequence of proposals correctly when multiple proposals target the same line.
- Verify `approveAll()` / `rejectAll()` logging is not too noisy: individual approvals currently log and the batch action logs once more. This is human activity rather than duplicate tool attribution, but the UI may benefit from a batched store resolver.
- Verify `registered = true` is reset or robust if tool registration fails mid-loop.
- Verify WebMCP schemas and return shapes in a real WebMCP-enabled browser.

## 8. Commands already run and results

Before edits:

```powershell
npm run lint
# PASS, exit 0

npx tsc -b --pretty false
# PASS, exit 0

npm run build
# PASS, exit 0
# vite v8.2.2, 36 modules transformed
```

Inspection commands included `rg --files`, `git status --short`, file reads, and JSON catalog summaries.

At the handoff boundary:

```powershell
git status --short
git diff --stat
git ls-files --others --exclude-standard
git branch --show-current
git rev-parse --short HEAD
```

These were read-only and succeeded. No post-edit lint, typecheck, test, or build was run.

## 9. Tests/build/lint status

- Baseline before changes: lint PASS, TypeScript PASS, production build PASS.
- Current working tree: **UNVERIFIED and expected to fail TypeScript/build** because legacy components have not been migrated to the new store/types.
- Automated tests: **NOT ADDED**.
- Browser/manual checks: **NOT RUN**.
- Responsive checks: **NOT RUN**.

## 10. Shopify live-data status

- A typed adapter boundary and honest UI/source status constants were added.
- The deterministic demo adapter is the only active source.
- The official Shopify Global Catalog documentation at `https://shopify.dev/docs/agents/catalog/global-catalog` has **not yet been researched in this task**.
- No endpoint, auth flow, CORS behavior, browser integration, or MCP call was verified.
- No live Shopify code should be claimed or enabled based on the current scaffold.
- Next live-data step: read the official documentation, identify the supported MCP transport/client context and auth/CORS requirements, then decide whether a browser-safe read-only adapter is verifiable. If not, keep the adapter disabled and document the exact next server-side integration step.

## 11. Remaining prioritized plan

1. **Restore compilation without weakening the new state model.** Wire `CategoryChooser` into `App.tsx`, then migrate all existing cart/product/header/voice components to `cart + proposals` and domain-aware fields.
2. **Complete the visible workspace.** Render Header → Decision Brief → Shortlist → catalog → activity, with cart alongside/on a mobile drawer. Add explicit category-reset confirmation when cart, proposals, or a nonblank brief exists.
3. **Fix voice and batch narration.** Make voice domain-aware, refer to proposals separately, and debounce automatic proposal speech so it summarizes a completed sequential batch.
4. **Implement Hallmark tokens and responsive CSS.** Create `tokens.css`, rewrite `src/index.css` with the required stamp and design tokens, style all new semantic classes, preserve warm Co-Cart identity, and verify 320/375/414/768 px with no horizontal scroll or wrapped primary buttons.
5. **Add focused tests.** Install Vitest, add ranking tests for all presets and proposal-state tests for the four critical integrity cases.
6. **Verify WebMCP audit behavior.** Assert one activity entry per tool call, including reads/errors, and correct tool attribution.
7. **Research Shopify official docs.** Only implement a live adapter if the official flow can be safely verified; otherwise keep the demo fallback and document the precise next step.
8. **Update README and PRD.** Clearly distinguish completed demo, unavailable live source, and future work.
9. **Run full verification.** `npm run lint`, `npx tsc -b --pretty false`, tests, production build, all three launch flows, original grocery hero scenario, approval integrity scenarios, and required viewport checks.

## 12. Critical risks

- Do not “fix” compilation by reintroducing embedded proposal status into confirmed cart lines; that recreates the integrity bugs.
- Do not silently switch domains or preserve a cross-domain cart. Require a visible reset/confirmation.
- Do not expose fictional demo merchants/prices as live facts.
- Do not call the product Shopify-powered or Shopify-native in the current state.
- Do not let `compare-options` invent support for arbitrary criteria; keep unknown as unknown.
- Do not log the same WebMCP invocation from both the store action and tool wrapper.
- Do not ship until post-refactor build/tests and manual flow checks pass.
- Preserve unrelated/user changes if the tree changes after this handoff; current edits are uncommitted.

## 13. Exact next command/action for a cold-start agent

From `C:\Users\adeto\Documents\WEB MCP\co-cart`, first run:

```powershell
npm run build
```

Capture the complete compiler output. Then start the repair at `src/App.tsx`: render `CategoryChooser` when `domain === null`, and render the workspace with `Header`, `DecisionBrief`, `Shortlist`, `ProductGrid`, `ActivityLog`, `CartPanel`, and `CheckoutConfirmation` when a domain is active. Migrate legacy components to `cart + proposals`; do not change `src/store/proposalState.ts` merely to satisfy their old API.

Before further design edits, re-read the Hallmark skill and relevant references because it was an explicitly required workflow.

## 14. Acceptance criteria

The task is complete only when all of the following are true:

- Entry screen has the three required prominent category cards, exact preset requests, one-line “Try this demo” controls, and “Start with my own request.”
- Category switching is obvious and cannot mix carts or silently discard meaningful work.
- Original 48-meal catalog and original meal hero scenario still work.
- Gadget and clothing datasets are clearly labelled demo data and expose meaningful comparison attributes.
- Demo data / Live data indicator is visible and truthful.
- Decision Brief is compact, editable, and covers Required, Preferred, Budget, Deal-breakers, and relevant Delivery deadline.
- Shortlist shows three explainable choices, requirement-level results, explicit tradeoffs, and inspectable deterministic fit points—not percentages.
- “Lowest listed price” is distinguished from value/final cheapest, with shipping/tax limitations visible.
- Search, detail, ranking, proposals, constraints, and visible state are category-aware through WebMCP.
- Every meaningful WebMCP invocation creates one correctly attributed audit entry.
- Agent addition to an existing confirmed line can be rejected without changing original quantity.
- Rejected swap keeps the original product.
- Every agent removal of a confirmed item requires approval.
- Batch speech summarizes the completed proposal batch.
- Checkout is blocked until every agent proposal has a human decision.
- UI preserves warm Co-Cart identity and passes focus-visible, reduced-motion, semantic-label, single-line-affordance, and no-horizontal-scroll checks at 320, 375, 414, and 768 px.
- Shopify live integration is either verified and honestly active behind the adapter, or explicitly unavailable with the demo fallback and documented next step.
- Focused ranking and proposal-state tests pass.
- Lint, TypeScript, tests, and production build pass.
- Main flows for all three cards and the original meal scenario are manually exercised.
- README and PRD distinguish completed, fallback, and future/live work.
- No deployment, external account, Shopify store, remote repository, or publication is created without further authorization.
