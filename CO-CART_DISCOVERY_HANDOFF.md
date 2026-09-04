# Co-Cart Open Product Discovery — Implementation Handoff

**Date:** 2026-09-04 · Implements `WORKFLOW.md` (open product discovery as the primary experience).

## 1. Files created

| File | Purpose |
| --- | --- |
| `src/decision/shoppingBrief.ts` | Shared domain-independent brief model: `validateShoppingBrief`, `validateDiscoveryReference`, `validateDiscoveryText`, `normalizeClarifyingQuestions` (server-side validation of model-generated questions), `isValidClarifyingAnswer`, `applyClarifyingAnswers`, `shoppingBriefToText`, `briefSignature`. |
| `src/agent/discovery.ts` | Client calls to `POST /api/discovery` (text / url / image) with response validation. |
| `src/agent/startDiscovery.ts` | Store-orchestrated flows: `startTextDiscovery`, `startUrlDiscovery` (https-only), `startImageDiscovery`, `startGeneralLiveSearch`. |
| `src/components/DiscoveryComposer.tsx` | Dominant 3-mode composer (Describe it / Upload a photo / Paste a link). One mode expanded at a time; per-mode content preserved while switching. Images are re-encoded through a canvas (metadata stripped) before upload. |
| `src/components/ClarificationDeck.tsx` | Renders generated clarifying questions (single/multiple/text/money), required-answer gating, agent-answer flash/scroll. |
| `src/components/BriefReview.tsx` | Editable normalized brief + interpretation reference with uncertainty notes; confirm → live search. Budget and delivery destination always editable. |
| `src/components/InterpretingScreen.tsx` | Progress stage with cancel. |
| `server/discovery.ts` | `handleDiscoveryInterpret` — OpenAI interpretation endpoint for all three modes with strict JSON-schema output, one retry with more output room on `incomplete`, `reasoning: low` for latency, 90s timeout, per-mode rate limits, concurrency guard. |
| `server/safeUrlFetch.ts` | SSRF-safe public-page fetch + metadata extraction (`extractPageFacts`). |
| `netlify/functions/discovery.ts` | Netlify wiring for `/api/discovery`. |
| Tests: `src/decision/shoppingBrief.test.ts`, `src/store/discoveryWorkflow.test.ts`, `server/safeUrlFetch.test.ts`, `server/discovery.test.ts` | 30 new tests (42 → 72). |

## 2. Files modified

- `src/types.ts` — `DecisionDomain` gains `"general"`; `AppStage` gains `entry | interpreting | clarifying | brief-review`; new `DiscoveryMode`, `DiscoveryReference`, `ShoppingBrief`, `ClarifyingQuestion`, `ClarifyingField`.
- `src/store/useStore.ts` — discovery state (`discoveryMode`, `discoveryReference`, `shoppingBrief`, `clarifyingQuestions`, `briefConfirmed`, `interpretationId`, `interpretationError`, `pendingRequest`) with operation-ID stale protection; `startGeneralDiscovery / completeInterpretation / failInterpretation / setClarifyingAnswer / proceedToBriefReview / updateShoppingBrief / confirmShoppingBrief / returnToEntry`. `continueShopping`/`returnToDecisions` return general sessions to `brief-review` (brief preserved on search failure).
- `src/App.tsx` — renders the three new stages inside the existing shell; entry screen unchanged route when no domain.
- `src/components/CategoryChooser.tsx` — rewritten as discovery-first entry: “What are you looking for?” + composer dominant; Meals/Gadgets/Clothing reduced to a compact **Try an example** strip that still enters the existing six-card flow. 3D bag kept beside the composer on desktop, hidden ≤800px so it never competes with the primary input.
- `src/components/AgentSearch.tsx` — general retry re-runs the confirmed brief; “Refine brief” returns to brief review.
- `src/components/Header.tsx` — `hasWork` includes `shoppingBrief`.
- `src/agent/liveSearch.ts` — shared NDJSON reader; new `searchGeneralCatalog` (posts `{ domain: "general", brief }`, **never consults the demo cache**).
- `src/agent/searchCoordinator.ts` — `runCoordinatedGeneralSearch` with the same single-flight guard.
- `src/data/catalog.ts`, `src/decision/questions.ts` — `general` domain config with an empty seeded catalog and no fixed question deck.
- `src/webmcp/tools.ts` — see §3.
- `src/voice/tools.ts` — snapshot exposes open search/interpretation/questions/brief; new voice tools (§3); general branch in `start_live_search`.
- `src/voice/realtimeAgent.ts` — exact-phrase map gains `confirm_shopping_brief → "confirm brief and search"`.
- `server/realtimeSession.ts` — `HANDS_FREE_TOOLS` gains `set_shopping_request`, `answer_clarifying_question`, `confirm_shopping_brief`; instructions: open with “What are you looking for?”, read back interpretation + uncertainty, one question at a time, no self-approval, no purchase claims.
- `server/liveSearch.ts` — accepts `domain: "general"` + validated `ShoppingBrief`; same OpenAI → Shopify MCP loop, provenance reconstruction, and unknown-product rejection; brief text built server-side from validated fields.
- `vite.config.ts`, `netlify.toml` — `/api/discovery` wiring.
- `src/index.css` — composer/example-strip/brief-review styles using existing tokens; responsive rules for 320/375/414/768.
- `README.md` — dated update note only (submission narrative untouched).

## 3. WebMCP tools

Added: `set-shopping-request` (exactly one of `request` | `url`; rejects local file paths), `answer-clarifying-question` (validated against the currently visible generated question), `confirm-shopping-brief` (merges clarifying answers, requires review stage).
Changed: `get-decision-state` now includes `discovery` (mode, interpretation, questions, answers, brief, confirmation, errors); `start-live-search` accepts the confirmed general brief (brief-review stage + confirmed required).
Removed: none. No tool can approve proposals or bypass the shopper; every tool writes one audited activity entry.

## 4. Security controls

- **URL mode:** https only; DNS resolved before every request and redirect; private/loopback/link-local/CGNAT/reserved/documentation/multicast ranges and IPv4-mapped IPv6 rejected (incl. `169.254.169.254`); ≤3 redirects; 2 MB body cap (head-truncated); HTML content-type only; 10s total timeout; no cookies/auth forwarded; extracted page data treated as untrusted in prompts.
- **Image mode:** JPEG/PNG/WebP only, ≤8 MB, magic-byte signature validated server-side; client re-encodes via canvas (metadata stripped); original never persisted — forwarded once to OpenAI; separate tighter rate limit; no bytes/paths/URLs exposed through tools.
- **All modes:** same-origin check, request-size caps, per-mode rate limits, concurrency guard, server-side key only, typed public errors (no stack traces/secrets), interpretation timeout with a single wider retry on `incomplete`.
- **Prompt injection:** page text is wrapped and labelled untrusted data; `extractPageFacts` uses a linear HTML scanner (no catastrophic regex backtracking).

## 5. Live vs cached vs not shipped

- Text, URL, and image discovery are **live** end to end (`/api/discovery` → OpenAI interpretation → clarification → brief review → existing verified OpenAI → Shopify search).
- The three example journeys keep their exact-answer warmed snapshots; **general briefs can never match the demo cache** (tested).
- Nothing was left as a disabled “coming soon” control.

## 6. Test results

- `npm test` — **72 passed / 12 files** (was 42).
- `npm run typecheck`, `npm run lint`, `npm run build` — all pass.

## 7. Browser / provider scenarios exercised

- Real text request → interpretation → 2 generated clarifying questions → brief review (budget/country/priorities merged) → confirm → **live Shopify search returned 3 real verified products** (real images, merchants, links); exactly one Agent’s final pick; add-to-cart from results works.
- URL mode live: `epomaker.com` product page → correct interpretation with uncertainty notes and source URL (13s).
- Image mode live: blank PNG honestly reported as unidentifiable with uncertainty notes.
- Rejection paths verified via API: non-https URL (400), `localhost`, private IP, and `169.254.169.254` (422), mismatched image signature (422), short text (400), missing API key (503, no fallback).
- Responsive: no horizontal overflow at 320 / 375 / 414 / 768 / 1280 (screenshot-verified at 375).
- Example journey (Gadgets six-card flow) still works.
- Not exercised live: WebMCP-enabled browser pass (tools registered only when `navigator.modelContext` exists; all logic paths are shared with the tested UI/store actions), realtime voice session (needs microphone; tools unit-tested via `executeVoiceTool`).

## 8. Known limitations

- Interpretation latency depends on upstream OpenAI load (observed 6–43s); timeout is 90s with one retry.
- Image interpretation on Netlify functions may hit platform function timeouts for slow upstreams; client shows a recoverable retry.
- URL extraction reads the document head region; pages that render product data only via client-side JS yield sparse facts and the shopper is offered text input instead.
- No commits, pushes, deploys, or submission edits were made.
