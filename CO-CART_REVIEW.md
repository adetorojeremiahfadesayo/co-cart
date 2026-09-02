# Co-Cart repair review

Status: repaired and verified locally on 2026-09-01.

## What was corrected

- Preserved the separate confirmed-cart and proposal state model. Removed the legacy cart-status fields and compatibility item-level proposal helpers.
- Added independent Approve and Reject controls for every proposal, while keeping batch decisions. Batch decisions now produce one human audit event.
- Added focused proposal-state and ranking tests. Rejected add, remove, and swap proposals preserve the original confirmed cart.
- Corrected deal-breaker polarity and wording. Unknown required or deal-breaker criteria no longer qualify an option as eligible.
- Made the visible shortlist use the same active filtered catalog as the WebMCP comparison tool.
- Made constraint and voice budget reporting use the active Decision Brief, and limited voice “show all” counts to the active domain.
- Debounced spoken proposal summaries so a multi-tool batch is announced once with its projected listed subtotal.
- Made WebMCP registration retry-safe and removed the extra system audit entry from agent checkout.
- Added destructive category-change confirmation, a keyboard-safe cart dialog, quantity/remove controls for confirmed lines, and per-proposal decisions.
- Fixed mobile header structure and horizontal overflow at the required viewport widths.
- Reworked the entry screen into an asymmetric Workbench layout and added a shared token file, focus rings, reduced-motion handling, and Hallmark project metadata.
- Replaced unverified browser/version claims with runtime capability language and updated this README for the multi-domain architecture.

## Boundaries that remain explicit

- Catalog values are deterministic demo data, not live offers.
- Shipping and tax are not included.
- Shopify Global Catalog is represented only by an adapter/status boundary; no live connection is claimed.
- Checkout is a demo confirmation and never charges a payment method.

## Verification

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — 2 files, 8 tests passed
- `npm run build` — pass
- Browser console — no warnings or errors
- Responsive checks — no horizontal overflow at 320, 375, 414, or 768 px on the entry screen or workspace
- Manual flows — Meals, Gadgets, and Clothing presets exercised; active brief budgets displayed correctly
- Approval integrity — rejected agent add preserved the confirmed cart; pending proposals disabled checkout; quantity controls worked
- WebMCP audit — successful search and successful agent checkout each added exactly one agent audit entry
