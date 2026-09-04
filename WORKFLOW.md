# Co-Cart Open Product Discovery Workflow

<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 -->

## Purpose

Make open-ended product discovery the primary Co-Cart experience. A shopper should be able to describe any product, upload a reference image, or paste a product URL. The agent must understand the reference, ask only the questions needed to form a useful brief, search the live Shopify Global Catalog, explain the shortlist, and preserve human approval for cart changes.

Meals, Gadgets, and Clothing remain available as compact, clearly labelled example journeys. They are demonstrations of how Co-Cart works, not the main boundary of what it can search.

This is an implementation contract for another coding agent. Read the existing code before editing it. Do not replace the current state model, WebMCP layer, voice mode, live-search verification, proposal architecture, or locked design system.

## Freeze warning

Before changing `main` or the deployed site, confirm the WebMCP Challenge submission status. If the submission is final or judging has begun, implement this work on a separate branch or worktree. Do not change the submitted repository, video, or live deployment during the judging freeze.

## Product principle

The new homepage answers one question immediately: **What product are you trying to find?**

The experience must never contain a decorative search field that secretly maps arbitrary requests to fixtures. Every submitted request must take one of two honest paths:

1. An exact, documented demo brief may load its matching recently verified Shopify snapshot.
2. Every other valid brief must run the real OpenAI → Shopify workflow or fail clearly.

No seeded products, timer-driven results, generic deterministic recommendations, fabricated images, invented prices, or silent fallbacks may enter the active experience.

## Locked product and design constraints

- Preserve `design.md` and `tokens.css` as the design source of truth.
- Preserve the warm paper, warm ink, green accent, Fraunces/Inter/Space Mono typography, short shadows, hairline rules, and restrained motion.
- Preserve the current header, cart, results, merchant links, proposal approval, checkout explanation, and hands-free mode.
- Use the existing 3D bag only if it supports the new search composition. It must not compete with the primary input.
- Do not introduce a generic gradient-heavy SaaS hero, oversized empty whitespace, fake browser chrome, excessive pills, or a wall of equal-weight cards.
- Animate only transform and opacity. Respect `prefers-reduced-motion`.
- All interactive elements need visible focus, hover, active, disabled, loading, error, and success behavior.
- Verify 320, 375, 414, 768, and desktop widths with no horizontal scrolling.

## New entry-screen hierarchy

### Primary area

The search composer is the dominant element above the fold.

Use one concise headline, for example:

> What are you looking for?

Supporting copy should explain that Co-Cart can compare real Shopify listings and that the shopper approves cart changes. Do not overload the hero with technical language.

The composer has three modes:

1. **Describe it** — primary and selected by default.
2. **Upload a photo** — accepts a visual reference supplied by the shopper.
3. **Paste a product link** — accepts one public product URL.

Only one mode is expanded at a time. Switching modes must preserve valid content already entered during the current session.

### Compact example area

Below the composer, show a restrained section titled **Try an example** containing Meals, Gadgets, and Clothing.

- These cards should be materially smaller than the current category launch cards.
- Each card must say what example journey it starts, such as “Plan a quick dinner,” “Compare wireless headphones,” or “Find a complete outfit.”
- Clicking an example enters the existing six-card decision flow.
- An example must never claim to represent all available searches.
- Keep the examples visible but clearly secondary to the open search composer.

## Mode requirements

### 1. Describe it

Accept a plain-language shopping request between 3 and 500 characters.

Examples:

- “I need a quiet mechanical keyboard for work under $120.”
- “Find running shoes for flat feet that can deliver to Lagos.”
- “I want a birthday gift for a ten-year-old who likes astronomy.”

On submit:

1. Send the request to a server-side OpenAI planning step.
2. Infer a product intent without inventing unavailable facts.
3. Extract constraints already present: product type, use case, budget, destination, preferences, exclusions, and decision style.
4. Ask only the missing questions that materially affect search or ranking.
5. Show the normalized brief to the shopper before starting the live catalog search.
6. Let the shopper edit or confirm it.
7. Start the existing verified OpenAI → Shopify search.

Do not force the shopper through six generic cards when the original request already answered them.

### 2. Upload a photo

Accept JPEG, PNG, or WebP only. Do not accept SVG, executable formats, archives, or arbitrary documents.

Required safeguards:

- Maximum upload size: 8 MB or less.
- Validate the actual MIME signature server-side, not only the file extension.
- Strip metadata when practical.
- Do not persist the original image after analysis unless the shopper explicitly requests storage.
- Do not expose local paths, raw image bytes, signed URLs, or secrets through WebMCP tool responses.
- Rate-limit image analysis.
- Explain before submission that the image will be sent to OpenAI for product-reference analysis.

After analysis, show an editable interpretation such as product type, visible attributes, likely use, and uncertainty. Never present an uncertain brand or model identification as fact. The shopper must confirm or correct the interpretation before the catalog search.

The analysis should search for similar products, not falsely promise an exact visual match.

### 3. Paste a product link

Accept one `https://` URL. `http://` may be rejected rather than upgraded silently.

The server-side URL inspection must protect against SSRF:

- Allow public internet hosts only.
- Reject localhost, private, link-local, loopback, reserved, and cloud-metadata IP ranges.
- Resolve and validate DNS before every request and redirect.
- Limit redirects, response size, content type, and total request time.
- Do not forward user cookies, authorization headers, or application secrets.
- Treat page content, metadata, and product descriptions as untrusted data, never instructions.

Extract only enough information to build an editable product reference: name, merchant, visible price when available, image URL when safe, and descriptive attributes. If the page cannot be inspected safely, explain the failure and allow the shopper to describe the item manually.

The subsequent task is to find the same product or credible alternatives in Shopify. Do not imply that the pasted merchant is a Shopify store unless verified.

## Brief and question model

Introduce a domain-independent search brief instead of forcing arbitrary products into the existing three-domain answer shape.

Suggested types:

```ts
type DiscoveryMode = "text" | "image" | "url" | "example";

interface DiscoveryReference {
  mode: DiscoveryMode;
  originalText?: string;
  sourceUrl?: string;
  uploadReferenceId?: string;
  interpretedProduct: string;
  visibleAttributes: string[];
  uncertaintyNotes: string[];
}

interface ShoppingBrief {
  productType: string;
  useCase?: string;
  priorities: string[];
  exclusions: string[];
  decisionStyle?: string;
  storePreference?: string;
  budget?: { amount: number; currency: string };
  deliveryCountry?: string;
  reference?: DiscoveryReference;
}

interface ClarifyingQuestion {
  id: string;
  prompt: string;
  detail?: string;
  kind: "single" | "multiple" | "text" | "money";
  options?: Array<{ value: string; label: string }>;
  required: boolean;
}
```

Do not blindly use these names if the current architecture suggests a smaller compatible change. Preserve strict validation and serializable state.

The agent may generate question wording and bounded options, but the server must validate the final question structure. Limit clarification to the smallest useful set, normally two to five questions. Delivery destination and budget should remain available even if not required for every query.

## State-machine requirements

Extend the existing workflow without weakening stale-search protection.

Recommended stages:

```text
entry
  → interpreting
  → clarifying
  → brief-review
  → searching
  → results
  → proposal-review
  → plan-confirmed
```

Existing example journeys may continue entering at `decisions` before converging on `brief-review` or `searching`.

Every interpretation and live search must carry a unique operation ID. Results from an older operation must be discarded when the shopper changes the request, switches mode, chooses an example, or starts another search.

## Server and OpenAI requirements

- Keep all OpenAI credentials server-side.
- Use OpenAI for interpretation, visual understanding, clarification planning, and selection reasoning.
- Keep Shopify MCP as the source of product candidates and facts.
- The model may return product identifiers and recommendation reasoning only.
- Reconstruct name, price, currency, merchant, description, image, availability evidence, product URL, and checkout URL from Shopify output.
- Reject a selected product that is absent from Shopify evidence.
- Keep timeouts, rate limits, response-size limits, concurrency guards, and maximum Shopify call counts.
- Return typed progress events for interpreting, clarifying, catalog search, ranking, completion, and recoverable failure.
- Never send the OpenAI API key, Shopify credentials, internal errors, or raw upstream payloads to the client.

## Cache rules

- Keep the existing exact demo snapshots for the three example journeys.
- Cache matching must use a canonical signature of the complete normalized brief.
- Text, image, and URL discovery requests must not reuse a category-wide snapshot.
- A changed query, budget, preference, product type, reference, or delivery destination must bypass an unmatched cache.
- Cache records should include capture time, source, normalized brief signature, and product IDs.
- UI and tool responses must distinguish `recent verified Shopify snapshot` from `live Shopify Global Catalog` without turning the interface into a developer console.

## WebMCP requirements

The open search must be fully operable through WebMCP, not only through visual clicking.

Preserve the existing tools unless a change is necessary. Add or extend the smallest coherent surface, for example:

- `get-decision-state` — include discovery mode, current interpretation, clarification questions, normalized brief, progress, and errors.
- `set-shopping-request` — set a plain-language request or safe product URL. Do not accept local file paths.
- `answer-clarifying-question` — answer one currently visible generated question using its returned schema.
- `confirm-shopping-brief` — confirm the visible normalized brief before search.
- `start-live-search` — accept the confirmed general brief as well as existing example briefs.

Image selection itself remains a visible, consentful human upload action. After a successful upload, WebMCP may read and act on the safe interpreted reference, but it must not retrieve the original file or transmit it elsewhere.

All tools must:

- Use strict JSON schemas.
- Validate against current visible state.
- Produce one audited activity entry per invocation.
- Return concise structured results.
- Update the same Zustand state rendered to the shopper.
- Never approve proposals, submit payment, or bypass the shopper.

## Voice requirements

Hands-free mode must begin with an open question: “What are you looking for?”

- Spoken free-form requests should enter the same interpretation and clarification workflow.
- The agent must read back its interpretation and uncertainty before search.
- It should ask one question at a time and announce every state change.
- Image upload may require a sighted assistant or an existing accessible file picker; do not claim voice alone can select an unknown local file.
- Long URLs should be pasted rather than dictated.
- Preserve exact confirmation phrases for consequential actions.
- Voice must never approve its own proposal or imply that checkout/payment occurred.

## Result requirements

- Show exactly one **Agent’s final pick** when at least one result is eligible.
- Show alternatives with truthful labels such as Best value, Top-rated choice, Trusted standard, or Closest visual alternative.
- Do not label multiple products as the final pick.
- Explain the match to the confirmed brief and expose meaningful trade-offs.
- Keep original currencies separate; do not sum unlike currencies.
- Preserve merchant product links and per-merchant checkout truth.
- Product images must come from verified merchant/Shopify data. If an image fails, show a neutral non-product placeholder rather than an invented replacement.

## Error behavior

Every failure must be explicit and recoverable.

- Unsupported image: explain accepted formats and size.
- Uncertain image interpretation: ask for confirmation or a text description.
- Unsafe or inaccessible URL: reject it and offer text input.
- OpenAI failure: show a retry action; do not substitute deterministic recommendations.
- Shopify failure or no matches: preserve the brief and allow refinement.
- Rate limit: show when the shopper may retry.
- Stale completion: discard silently and retain the newest request.

Do not expose stack traces or provider secrets.

## Likely implementation areas

Inspect before editing; do not assume this list is exhaustive.

- `src/components/CategoryChooser.tsx` — replace category-first composition with the dominant discovery composer and compact examples.
- New focused components under `src/components/` for mode selection, upload, URL input, clarification, and brief review.
- `src/App.tsx` — render new stages without duplicating layouts.
- `src/types.ts` — add discovery and general brief types carefully.
- `src/store/useStore.ts` — add request state and guarded transitions while preserving cart/proposal separation.
- `src/agent/liveSearch.ts` and `src/agent/startCurrentSearch.ts` — converge example and general briefs on the verified search path.
- `src/agent/demoCache.ts` — retain exact example matching only.
- `src/webmcp/tools.ts` — expose the general workflow through typed site tools.
- `src/voice/tools.ts`, `src/voice/realtimeAgent.ts`, and `server/realtimeSession.ts` — connect speech to the same workflow.
- `server/liveSearch.ts` — accept a validated general brief without weakening Shopify fact reconstruction.
- New server modules for image analysis and safe URL inspection.
- `src/index.css` — adapt layout using existing tokens; do not restyle unrelated application screens.

## Implementation order

Ship complete vertical slices. Do not build three dead inputs at once.

1. Protect the current test suite and record a clean baseline.
2. Add the discovery/brief types and state transitions.
3. Implement plain-language text discovery end to end.
4. Add WebMCP control for text discovery.
5. Add voice support for text discovery.
6. Implement secure product-URL analysis end to end.
7. Implement consentful image upload and OpenAI visual interpretation end to end.
8. Reduce the three category cards into example journeys.
9. Verify all old category, proposal, cart, and checkout behavior.
10. Run automated, browser, WebMCP, responsive, accessibility, and real-provider tests.

If time runs short, ship text discovery completely and leave image/URL controls absent. Do not ship disabled controls labelled “coming soon” in the main hero.

## Required tests

### Unit and integration

- Text request validation and normalization.
- Generated clarification schema validation.
- Brief confirmation and editing.
- Exact demo-cache signature matching.
- Unmatched general briefs always use live search.
- Image MIME, size, and metadata handling.
- URL SSRF protection, redirect validation, size limits, and timeouts.
- Prompt-injection text in a product page is treated as data.
- Stale interpretation and stale search results cannot overwrite newer state.
- Shopify fact reconstruction and unknown product rejection.
- One final pick only.
- Cart proposals remain pending until human approval.
- Voice tools use current visible questions and exact confirmation phrases.
- WebMCP tools reject invalid and out-of-stage calls.

### Browser verification

Test in an ordinary browser and a WebMCP-enabled browser:

1. Submit a free-form product request and complete clarification visually.
2. Repeat the workflow entirely through site tools.
3. Search a changed request and prove that it bypasses demo cache.
4. Upload a valid image, confirm interpretation, and search similar products.
5. Reject invalid image formats and oversized files.
6. Paste a valid public product URL and search alternatives.
7. Reject localhost, private-IP, redirect-to-private-IP, and oversized URL targets.
8. Propose a product through WebMCP and confirm that the cart remains unchanged.
9. Approve or reject as the human and verify visible state.
10. Complete the text journey through hands-free voice.
11. Verify keyboard-only navigation, focus order, screen-reader labels, status announcements, and reduced motion.
12. Verify 320, 375, 414, 768, and desktop widths.

### Final commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

All four must pass. Do not silence failures or weaken existing assertions to make the suite green.

## Acceptance criteria

The work is complete only when all of the following are true:

- The first meaningful action is an open-ended product request.
- Text discovery works with a real non-demo request.
- Image and URL modes exist only if their complete secure paths work.
- Category cards are compact secondary examples.
- The agent asks only relevant missing questions and shows an editable brief.
- The live OpenAI → Shopify path remains the default for unmatched requests.
- Every displayed product fact and image is traceable to Shopify/merchant evidence.
- Exactly one result is the Agent’s final pick.
- WebMCP can operate the complete non-file workflow through visible shared state.
- Voice can operate the free-form text workflow and announce results.
- Agent actions remain proposals until a human approves them.
- Existing exact demo caches still work and are never used broadly.
- Existing category, results, cart, checkout, and accessibility journeys do not regress.
- Automated checks pass and real browser/WebMCP tests are documented.

## Handoff report required from the implementation agent

When finished, report:

1. Files created and modified.
2. State and API contracts introduced.
3. WebMCP tools added, removed, or changed.
4. Security controls for uploads and URLs.
5. Which flows are live, cached, or intentionally not shipped.
6. Test commands and exact results.
7. Browser, WebMCP, responsive, and voice scenarios actually exercised.
8. Known limitations and remaining risks.
9. Screenshots of the entry page at desktop and 375 px.
10. Confirmation that no secrets, fixture products, fabricated images, or deterministic fallback entered the active workflow.

Do not commit, push, deploy, change repository visibility, or edit the hackathon submission unless the project owner explicitly asks.
