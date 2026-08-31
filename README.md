# Co-Cart 🛒🤖

**An agent-native meal-kit grocery store, built for the [WebMCP Challenge](https://webmcp.devpost.com/).**

Co-Cart is a normal, fully usable grocery storefront — plus a complete [WebMCP](https://github.com/webmachinelearning/webmcp) tool surface so an AI agent in your browser can shop *with* you: it searches the catalog, fills the cart under your constraints (calories, allergens, budget), and proposes swaps — while **you stay in control**: every agent action lands as a visible proposal you approve or reject.

## Try the hero scenario

In a WebMCP-enabled browser, tell your agent:

> **"Find me 3 dinners under 400 kcal each, no peanuts (allergy), keep the total under $60, and fill my cart."**

Watch the grid re-filter live, the cart fill with amber **🤖 agent** badges, a peanut-containing favorite get swapped out with a stated reason, and the budget meter update in real time. Then approve, reject, or ask for changes — nothing reaches checkout without your say.

## WebMCP tools (10)

| Tool | What it does |
|---|---|
| `search-products` | Filters the catalog **and the visible grid** by query, category, kcal, protein, price, allergens, diets, tags |
| `get-product` | Full details for one product |
| `add-to-cart` | Adds an item as a **proposal** (user must approve), with a reason shown in the UI |
| `remove-from-cart` | Removes an item; user-added items become a **proposed removal** instead |
| `swap-item` | Atomic replacement (e.g. allergen swap) rendered as "A → B" with reason |
| `get-cart` | Full cart state: statuses, reasons, totals, pending-approval count |
| `check-constraints` | Validates the cart against budget / kcal / allergens / item count, returns violating item ids |
| `set-preferences` | Persists allergens, diets, weekly budget (shown as header chips) |
| `highlight-products` | Pulses product cards in the grid and scrolls to them |
| `checkout` | **Refused while any proposal is pending** — human approval is a hard gate |

## Accessibility by construction

Every store capability is exposed as a tool, so the entire store is operable without touching the UI. On top of that, an **in-page voice layer** (Web Speech API) completes a hands-free, eyes-free loop:

1. Speak your request to your agent (e.g. ChatGPT Desktop voice mode).
2. The agent fills the cart via WebMCP tools.
3. Co-Cart **speaks the proposals aloud** (toggle: 🔊) — "The agent proposed 3 changes — total $54.90, including a swap…"
4. Reply by voice: **"approve all"** · "reject the salmon" · "read my cart" · "what's my total" · "checkout" · "help".

Voice commands map to the *same store actions* the WebMCP tools and the UI use — one action layer, three callers.

## Running locally

```bash
npm install
npm run dev
```

### Enabling agent mode

- **ChatGPT Desktop** — WebMCP is supported natively; just open the app URL in it.
- **Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing`, restart, open the URL.
- **Edge 150+** — WebMCP origin trial.

Without a WebMCP browser the store works normally and shows a small banner explaining how to enable agent mode.

## Stack

Vite · React · TypeScript · Tailwind CSS v4 · Zustand (single store shared by UI, WebMCP tools, and voice) · no backend, no auth — deployable anywhere static (see `netlify.toml`).

## Repo layout

```
src/
├─ data/products.json      # ~48 seeded meal-kit products (kcal, allergens, diets, prices)
├─ store/useStore.ts       # Zustand: cart state machine, prefs, filters, activity log
├─ webmcp/tools.ts         # the 10 WebMCP tool registrations
├─ voice/                  # recognition.ts (push-to-talk), intents.ts (grammar), speak.ts (TTS queue)
└─ components/             # grid, cart with approve/reject, constraint meter, activity log…
```
