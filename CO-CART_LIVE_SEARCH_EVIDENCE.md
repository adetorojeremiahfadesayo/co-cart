# Co-Cart Credentialed Live Search Evidence

Date: 2026-09-02  
Environment: local Vite server at `http://127.0.0.1:5173`  
OpenAI model: `gpt-5.6`  
Catalog transport: validated server-side JSON-RPC calls to `https://catalog.shopify.com/api/ucp/mcp`

## Scope and interpretation

These are paid, credentialed integration runs through the same `/api/search` endpoint used by the visual **Go** action and the hands-free agent. Each request used an exact answer set accepted by the app's decision validator, a unique browser-session identifier, a same-origin header, and NDJSON streaming.

For every successful run:

- OpenAI selected strict Shopify catalog functions.
- The server validated the arguments, injected the required UCP agent profile, and executed Shopify MCP `tools/call` requests.
- The server accepted only exact variants found in successful Shopify output and reconstructed product title, seller, price, currency, and URL from that output.
- No seeded, deterministic, or fabricated product fallback was used.

Product facts below are a point-in-time record, not a promise of continued price, stock, shipping, or merchant availability. Recommendation summaries are agent-authored; product facts are server-reconstructed from Shopify output. The current public result contract does not expose a separate normalized availability field, so this record does not independently assert stock.

## Results overview

| Domain | UTC start | Duration | HTTP | Shopify calls | Verified results |
|---|---:|---:|---:|---:|---:|
| Meals | 2026-09-02 09:43:33 | 24.492 s | 200 | 2 | 5 |
| Clothing | 2026-09-02 09:44:24 | 17.179 s | 200 | 1 | 5 |
| Gadgets | 2026-09-02 09:45:08 | 36.633 s | 200 | 3 | 4 |

All three responses ended with a `result` event and no `error` event. All returned prices were USD in these US-destination test cases.

## Meals

Input:

- Meal type: `quick dinner`
- Priorities: `low calorie`, `best value`
- Budget: `50`
- Ships to: `US`

Observed progress:

`Connecting to OpenAI` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Comparing verified options` -> result

Agent summary:

> Five currently available US-catalog picks prioritize fast preparation, lower calories, and value within the $50 budget. Multipacks offer the strongest cost per serving; single meals are more complete and convenient.

Verified Shopify records returned to the app:

| Product | Merchant | Listed price | Returned listing |
|---|---|---:|---|
| Street Corn Chicken | Herculean Prepared Meals | USD 10.99 | [Listing](https://herculeanmeals.com/products/street-corn-chicken?variant=41697412317265) |
| Wild Tuna & Quinoa Salad Ready-To-Eat Meal | Wild Planet Foods | USD 20.00 | [Listing](https://wildplanetfoods.com/products/wild-tuna-quinoa-salad?variant=43164289630456) |
| Ben's Original - Favourites Paella Chorizo and Vegetable Microwave Rice Meal (6x 250g) | Yachew | USD 33.00 | [Listing](https://www.yachew.com/products/bens-original-favourites-paella-chorizo-and-vegetable-ready-in-2-minutes-microwave-rice-meal-serves-1-multipack-6x-250g?variant=56323751739774) |
| Low Sodium Three-Bean Chili | Lentiful | USD 36.00 | [Listing](https://eatlentiful.com/products/low-sodium-three-bean-chili?variant=45246392205529) |
| ProteinWise - Sloppy Joe Mix - 7/Box | ProteinWise | USD 16.95 | [Listing](https://proteinwise.com/products/proteinwise-sloppy-joe-mix-7-mix?variant=16754582849) |

## Clothing

Input:

- Clothing type: `complete outfit`
- Priorities: `formal`, `breathable`
- Budget: `150`
- Ships to: `US`

Observed progress:

`Connecting to OpenAI` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Comparing verified options` -> result

Agent summary:

> Live, available two-piece outfits within the $150 budget. The strongest formal options are breathable linen or linen-blend blazer-and-trouser sets; one women's vest-and-skirt option is also included.

Verified Shopify records returned to the app:

| Product | Merchant | Listed price | Returned listing |
|---|---|---:|---|
| Tiavllya Fashion Men's 2 Pieces Mens Suit Peak Lapel Linen For Wedding (Blazer+Pants) | Tiavllya | USD 109.00 | [Listing](https://www.tiavllya.com/products/fashion-mens-2-pieces-mens-suit-peak-lapel-linen-for-wedding-blazer-pants?variant=47773016752445) |
| Linen Blazer Suit Set Tailored Fit 2 Piece Formal | Margot & James | USD 99.99 | [Listing](https://margotandjames.com/products/linen-blazer-suit-set?variant=54198072639825) |
| Marco Linen Suit Set | Riley Grove | USD 82.99 | [Listing](https://rileygrove.com/products/marco-linen-suit-set?variant=53886745772346) |
| Hank Men's Slim Lightweight Linen-Blend Suit Set with Blazer | Gentlemens Manor | USD 101.95 | [Listing](https://gentlemensmanor.com/products/hank-mens-slim-lightweight-linen-blend-suit-set-with-blazer?variant=57829007458636) |
| Cotton Linen Scallop Trim Vest & Skirt Set | COMMENSE | USD 69.00 | [Listing](https://thecommense.com/products/cotton-linen-scallop-trim-vest-skirt-set?variant=48248278941953) |

## Gadgets

Input:

- Gadget type: `wireless headphones`
- Priorities: `premium sound quality`, `best value`
- Budget: `200`
- Ships to: `US`

Observed progress:

`Connecting to OpenAI` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Searching Shopify` -> `Shopify call completed` -> `OpenAI agent comparing options` -> `Comparing verified options` -> result

Agent summary:

> Four live US options prioritized for sound quality, noise cancellation, battery life, and overall value. The first is the strongest all-around audio pick; the last is the budget-focused alternative.

Verified Shopify records returned to the app:

| Product | Merchant | Listed price | Returned listing |
|---|---|---:|---|
| ACCENTUM Plus Wireless | Sennheiser US - Sonova Consumer Hearing USA LLC | USD 129.95 | [Listing](https://us.sennheiser-hearing.com/products/accentum-plus?variant=47755243487515) |
| ACCENTUM Wireless | Sennheiser US - Sonova Consumer Hearing USA LLC | USD 99.95 | [Listing](https://us.sennheiser-hearing.com/products/accentum-wireless?variant=47999196135707) |
| soundcore Space Q45 - Long-Lasting Noise Cancelling Headphones | Soundcore | USD 149.99 | [Listing](https://us.soundcore.com/products/space-q45-a3040011?variant=41956218110142) |
| JBuds Lux ANC Headphones Mauve | JLab | USD 59.99 | [Listing](https://www.jlab.com/products/jbuds-lux-anc-headphones-mauve?variant=40342910042184) |

## Browser-driven live-results verification

An additional gadget search was launched from the actual decision UI after selecting all four visible decision cards and pressing **Go**. The browser showed the agent-search screen immediately, streamed progress, and then rendered four server-verified Shopify results. This run returned Sony WH-1000XM5, Sony WH-1000XM4, JBL Tune 780NC, and JLab JBuds Lux ANC listings from Focus Camera, Curacao, World Wide Stereo, and JLab respectively.

The first populated-results attempt exposed a real React Strict Mode crash: `LiveResults` returned the value of `window.scrollTo(...)` from `useEffect`, which React treated as an invalid cleanup function in the controlled browser. The effect now uses a block body and returns nothing. A fresh decision-to-search run rendered the full result screen successfully after the repair.

The populated gadget results were then inspected at 1440, 768, 414, 375, and 320 px:

| Width | Result columns | Horizontal overflow | Broken images | Outcome |
|---:|---:|---|---:|---|
| 1440 px | 3 | No | 0 | Pass |
| 768 px | 2 | No | 0 | Pass after tablet-header repair |
| 414 px | 1 | No | 0 | Pass |
| 375 px | 1 | No | 0 | Pass |
| 320 px | 1 | No | 0 | Pass after compact hands-free control |

Two responsive refinements were made during this pass:

- At 768 px, header actions previously wrapped into oversized full-width rows. The tablet header now remains a single compact row with an icon-only category-change control.
- At narrow widths, the fixed **Hands-free mode** pill obscured too much of the first product image. Below 900 px it now uses a compact 112 px **Hands-free** presentation while retaining the accessible name `Open hands-free voice shopping mode`.

The hands-free introduction panel was also opened at 320 px. It fit the viewport without horizontal overflow, exposed a labelled `Shop by speaking` dialog, focused its close button, and displayed the microphone/privacy/approval disclosures and start control. The microphone was not activated during this layout test.

The closed cart drawer was checked after an off-screen-element diagnostic. It already carries both `aria-hidden="true"` and `inert` while closed; no cart change was required.

Post-repair verification:

- `npm test`: 7 files, 32 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

## Remaining validation

- Repeat populated-result visual spot checks for meals and clothing; the shared product-card layout has already passed with real gadget data.
- Exercise explicit image-error handling and reduced-motion emulation.
- Complete a keyboard-only pass through result actions, the cart drawer, proposal approval, and category-change confirmation.
- Exercise the Netlify deployment to confirm NDJSON chunks are not buffered and both server endpoints retain their environment variables and timeout budget.
- Repeat destination-specific searches for Nigeria, the United Kingdom, and Canada before making any market-coverage claim.
