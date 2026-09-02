# Design — Co-Cart

A locked visual system for the live multi-domain shopping assistant. The Kimi prototype supplied by the project owner is the presentation source; Co-Cart's existing OpenAI, Shopify, approval, checkout, and Realtime behavior remains authoritative.

## Genre

Editorial consumer utility: calm, tactile, direct, and trustworthy.

## Macrostructure family

- Marketing/entry: split marquee with a manipulable 3D shopping-bag object and direct path into category selection.
- App screens: guided workbench, one primary task per screen, narrow reading measure, and persistent utility header.
- Results: live catalogue grid with merchant evidence and plain-language tradeoffs.

## Theme

- Paper: warm off-white.
- Ink: warm near-black.
- Accent: Shopify-adjacent agent green used for actions, focus, and live status.
- Rules: pale warm grey hairlines; shadows remain short and quiet.

The complete OKLCH values are in `tokens.css`.

## Typography

- Display: Fraunces, weight 600, normal or italic for emphasis.
- Body: Inter, weight 400–700.
- Mono: Space Mono, weight 400–700, reserved for compact status metadata.
- Display tracking: -0.025em.
- Long text measure: 45–70 characters.

## Spacing

A 4-point named scale from `--space-3xs` through `--space-3xl`. New authored CSS uses named tokens.

## Motion

- One initial rise/pop sequence per screen; no universal scroll reveals.
- Transform and opacity only for interface transitions.
- The 3D object responds to pointer position and pauses for reduced-motion users.
- Reduced-motion fallback is static or opacity-only and no longer than 150 ms.

## Microinteractions stance

- Immediate focus rings with strong contrast.
- Quiet hover shifts of at most 2 px.
- Visible, text-backed progress for live agent work.
- Silent success where the changed state is already visible.
- Approval is explicit before an agent proposal changes the confirmed cart.

## CTA voice

- Primary: solid green rounded rectangle, short verb-led copy.
- Secondary: white or paper surface with a hairline rule.
- Destructive: red text/border only where the action clears or removes data.

## Per-screen allowances

- Entry screen may use the interactive 3D bag.
- Decision, search, result, cart, and accessibility screens prioritize function over decoration.
- Product imagery comes from live Shopify results; no stock-image fallback is presented as a product.

## What every screen must share

- Co-Cart wordmark, paper/ink/green palette, Fraunces/Inter pairing, button voice, focus treatment, and hairline cards.
- Honest source language: OpenAI and Shopify Global Catalog when live search is active.
- Honest checkout language: checkout is per merchant when multiple merchants are involved.

## What must not be copied from the Kimi prototype

- Static `PRODUCTS` or invented `STORE_URLS`.
- Timer-driven simulated agent progress.
- Browser string-matching as a substitute for the OpenAI Realtime agent.
- Direct agent mutation of the confirmed cart.
- A fake card-payment form or a claim that multiple independent merchants can be paid in one standard checkout.

## Exports

### CSS

The canonical export is `tokens.css` in the project root. `src/index.css` maps it into Tailwind v4.

### DTCG mapping

- `color.paper` → `--color-paper`
- `color.ink` → `--color-text`
- `color.accent` → `--color-accent`
- `font.display` → `--font-display`
- `font.body` → `--font-body`
- `space.md` → `--space-md`

### shadcn/ui mapping

- `--background` → `--color-paper`
- `--foreground` → `--color-text`
- `--primary` → `--color-accent-deep`
- `--border` → `--color-line`
- `--ring` → `--color-focus`
