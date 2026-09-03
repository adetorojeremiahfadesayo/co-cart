<div align="center">

<img src="src/assets/hero.png" alt="Co-Cart" width="130">

# Co-Cart

**An AI agent that shops with you — and can't make anything up.**

*You answer six plain questions. A real agent searches live Shopify stores. Every price on your screen came from a merchant, not a model. And nothing enters your cart until you say yes.*

[**🛒 Live app**](https://co-cart-live.netlify.app) ·
[Architecture](#how-it-actually-works) ·
[The 13 agent tools](#the-13-tools-the-page-hands-to-an-agent) ·
[Engineering notes](#engineering-notes--things-i-got-wrong-first)

![License: MIT](https://img.shields.io/badge/License-MIT-7C5CFF.svg)
![WebMCP](https://img.shields.io/badge/WebMCP-13%20page%20tools-4C1D95.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-Responses%20%2B%20Realtime-10A37F.svg)
![Shopify](https://img.shields.io/badge/Shopify-Global%20Catalog%20MCP-95BF47.svg)
![Tests](https://img.shields.io/badge/tests-35%20passing-2E9C6E.svg)
![Netlify](https://img.shields.io/badge/Netlify-deployed-00C7B7.svg)

*Built for the WebMCP Challenge*

</div>

---

## The moment that started this

I asked an AI assistant to find me a pair of wireless headphones under $50.

It came back with five options. Beautifully written. Confident. Prices, brand names, little pros-and-cons for each. It read like advice from a friend who'd actually done the research.

Three of the five didn't exist.

Not "out of stock" — **didn't exist**. Plausible names at plausible prices from plausible-sounding stores, assembled by a model that had been asked to be helpful and had no way to check. The two that were real had prices from whenever its training data was frozen.

That's the thing nobody says out loud about AI shopping: the model isn't lying, it's *pattern-matching*. And a pattern-matched price is indistinguishable from a real one right up until you click through and find nothing there.

So I built the opposite.

**In Co-Cart, the model is never allowed to write a product fact.** It picks Shopify variant IDs — that's all. The server takes those IDs, goes back to Shopify's own response, and reconstructs the title, price, currency, merchant, image, and checkout link from the merchant's data. If the model names a product that isn't in the Shopify output, the request is rejected. Not corrected — **rejected**.

The second thing: an agent that can shop should never be able to *buy*. Every cart change an agent makes lands as a **proposal** with approve/reject buttons. Your confirmed cart cannot move without your click. Not as a setting. As an architecture.

---

## Table of contents

- [What it feels like to use](#what-it-feels-like-to-use)
- [What makes it different](#what-makes-it-different)
- [How it actually works](#how-it-actually-works)
- [The 13 tools the page hands to an agent](#the-13-tools-the-page-hands-to-an-agent)
- [Using Co-Cart from a WebMCP browser](#using-co-cart-from-a-webmcp-browser)
- [Shopping with your voice](#shopping-with-your-voice)
- [Where the data comes from (provenance)](#where-the-data-comes-from-provenance)
- [Run it yourself](#run-it-yourself)
- [Configuration](#configuration)
- [Deploy](#deploy)
- [Testing](#testing)
- [Engineering notes — things I got wrong first](#engineering-notes--things-i-got-wrong-first)
- [Project layout](#project-layout)
- [Honest limitations](#honest-limitations)
- [License](#license)

---

## What it feels like to use

Open [co-cart-live.netlify.app](https://co-cart-live.netlify.app). Pick **Meals**, **Gadgets**, or **Clothing**.

You get six decision cards. Not a search box — cards, in plain English, because "what are you actually trying to solve" is a better question than "what keywords do you know":

```text
What would make eating easier for you right now?     → Quick dinner
How should the agent choose for you?                 → Crowd favourite
Any preference on where it comes from?               → No preference
What would make this feel like the right choice?     → High protein
What is the comfortable ceiling?                     → Under $25
Where should it arrive?                              → [demo address prefilled]
```

That third question — **how should the agent choose for you** — is the one I'm proudest of. *Crowd favourite*, *best value*, *cheap but a hidden gem*, *the industry standard*. Most shopping tools decide what "best" means on your behalf and never tell you. This one asks. And your answer genuinely changes which items come back and how each is labelled.

Press **Go**, and you watch it work: connecting to OpenAI → searching Shopify Global Catalog → verifying finalists. Then a shortlist of real products, each with an honest reason it's there *and* the tradeoffs — the pouch that says "53 g protein" is quietly measuring two servings, and Co-Cart says so.

Add something. Open the cart. If **you** added it, it's just there. If an **agent** added it, it's sitting in a pending tray with **Approve** and **Reject**, and your subtotal shows both the confirmed number and what it'd become if you said yes.

Checkout doesn't charge you. It opens the actual merchant's Shopify checkout, because Co-Cart is a decision assistant, not a store.

---

## What makes it different

**The model never writes a product fact.** It returns `sourceId: "gid://shopify/ProductVariant/40193175978117"` and a recommendation. The server pairs that ID with Shopify's actual response and builds the product card from merchant data. A test called *"rejects a model selection that is absent from Shopify output"* keeps this honest, permanently.

**A successful `search_catalog` call is mandatory.** The agent can't get clever, skip the search, call a different Shopify function, and hand back a shortlist. No verified search, no results. There's a test for that too.

**There is no demo fallback on the live path.** This is the decision I'd defend hardest. If the API key is missing, or OpenAI fails, or Shopify is unreachable — you get an explicit, recoverable error that says exactly what broke. You never get seeded data quietly dressed up as live results. A demo that fails visibly is worth more than one that fails beautifully.

**Agents propose; humans dispose.** Confirmed cart lines and agent proposals are separate arrays in the store, and the only paths from one to the other run through a human click. Two tests exist purely to prove a rejected proposal leaves the confirmed cart byte-identical.

**Multiple currencies never get silently added together.** Shopify's global catalog will happily return a $13.99 item and a ₦21,900 item in the same shortlist. Most carts would mash those into one meaningless number. Co-Cart keeps per-currency subtotals separate and displays them separately, because "$35.99 + ₦21,900 = 21,935.99" is a lie with a decimal point in it.

**"Top-rated choice" requires actual evidence.** That badge only appears when the Shopify listing itself contains rating or review data. The agent is explicitly instructed never to invent ratings, review counts, or brand reputation. If the evidence isn't there, it picks a different label.

**Ships with a real accessibility path.** Hands-free voice mode isn't a demo toggle — it drives the same agent tool surface by speech, with the mic off until you opt in.

---

## How it actually works

```text
 ┌──────────────────────────────────────────────────────────┐
 │  React decision UI          WebMCP page tools (13)       │
 │  (what a human sees)        (what an agent sees)         │
 └────────────────────────┬─────────────────────────────────┘
                          │  same Zustand store, one truth
                          ▼
              POST /api/search   (Netlify Function)
                          │  server-side only, key never shipped
                          ▼
              OpenAI Responses API agent
                          │  emits shopify_* function calls
                          ▼
        validated server-side MCP executor
          · every argument type-checked
          · UCP agent profile injected
          · 6-call ceiling · 90s timeout
                          │  JSON-RPC
                          ▼
        Shopify Global Catalog MCP
        https://catalog.shopify.com/api/ucp/mcp
                          │
                          ▼
   facts reconstructed from Shopify's own response
   → streamed progress + verified shortlist (NDJSON)
```

The load-bearing idea is the **narrow waist in the middle**. OpenAI never talks to Shopify. It emits a function call; our server validates every argument against a strict schema, injects the required UCP agent profile, makes the JSON-RPC call itself, and hands back only the result. The model can't reach an arbitrary MCP endpoint, can't smuggle parameters through, and can't be the source of a single displayed fact.

### The stack

| Layer | What I used | Why |
| :--- | :--- | :--- |
| UI | **React 19** + **TypeScript** + **Vite 8** | Fast dev loop, strict types on the store |
| Styling | **Tailwind CSS v4** + hand-written design tokens | `tokens.css` holds the palette; the chunky neo-brutalist look is deliberate |
| State | **Zustand** | One store the UI *and* the agent tools read from — that shared truth is the whole point |
| 3D | **three.js** / **react-three-fiber** | The landing hero, lazy-loaded so it never blocks first paint |
| Agent | **OpenAI Responses API** (`gpt-5.6`) | Tool-calling loop with schema-enforced output |
| Voice | **OpenAI Realtime** (`gpt-realtime-2.1`) over WebRTC | Ephemeral client secrets — the server key never touches the browser |
| Catalog | **Shopify Global Catalog MCP** | Real listings, real merchants, real checkout links |
| Page tools | **WebMCP** (`navigator.modelContext`) | 13 tools registered silently on load |
| Hosting | **Netlify** + Netlify Functions | Static frontend and both API endpoints on one free plan |

---

## The 13 tools the page hands to an agent

Every tool maps one-to-one onto something a human can see and do. That constraint is the design: an agent should never have a capability that isn't visible in the UI.

| Tool | What it does |
| :--- | :--- |
| `get-decision-state` | Read the whole visible workflow — category, stage, questions, answers, results, cart, pending approvals |
| `select-domain` | Pick a shopping category and open its decision cards |
| `set-decision-answer` | Answer one card (options, or free text for the delivery address) |
| `start-live-search` | Run the real OpenAI → Shopify search, streaming into the visible UI |
| `get-live-results` | Read the verified shortlist — errors until a live search has actually succeeded |
| `get-product` | Full record for one product from the current shortlist |
| `add-to-cart` | **Propose** an addition |
| `remove-from-cart` | **Propose** a removal |
| `swap-item` | **Propose** an atomic swap; the original stays confirmed until approval |
| `get-cart` | Confirmed lines, pending proposals, and per-currency subtotals, kept apart |
| `check-constraints` | Validate the projected cart against numeric or allergen limits |
| `set-preferences` | Save standing dietary preferences for those checks |
| `highlight-products` | Draw the human's eye to specific items in the visible results |

Three details worth pointing out:

- **Every call is audited.** An `audited()` wrapper logs name, time, and outcome for every invocation, success or failure.
- **When an agent answers a card, the card flashes and scrolls into view.** You can watch the agent work rather than discovering afterwards that something changed.
- **The tools are invisible in the UI.** No banner, no "13 tools" panel, no badge. An agent-ready page shouldn't need to advertise it — the tools are just *there* for anything that knows to look.

Source: [`src/webmcp/tools.ts`](src/webmcp/tools.ts)

---

## Using Co-Cart from a WebMCP browser

Co-Cart registers its tools on `navigator.modelContext` at load. Nothing to click, nothing to enable.

Open [co-cart-live.netlify.app](https://co-cart-live.netlify.app) in a WebMCP-enabled browser or agent host and the tools are discoverable immediately. From an agent (or the console, host API depending):

```js
await navigator.modelContext.callTool("select-domain", { domain: "gadgets" });
await navigator.modelContext.callTool("set-decision-answer", {
  questionId: "gadget_type", values: ["wireless headphones"]
});
await navigator.modelContext.callTool("start-live-search", {});
await navigator.modelContext.callTool("get-live-results", {});
await navigator.modelContext.callTool("add-to-cart", { productId: "…" }); // proposal only
```

**The full-power sequence:** `get-decision-state` → `select-domain` → `set-decision-answer` ×6 → `start-live-search` → `get-live-results` → `highlight-products` → `add-to-cart`. Then stop, because the last step needs a human — which is the point.

No WebMCP browser handy? The hands-free voice mode drives the exact same tool surface, so you can demo the agent path in any browser with a microphone.

---

## Shopping with your voice

Press **Shop by voice** on any screen. The mic stays off until you open the panel and press start — that's a hard rule, not a preference.

Your audio goes over WebRTC straight to an OpenAI Realtime session. The agent reads the current screen through the same guarded tools, speaks your options aloud, records your exact choices, runs the same live search the **Go** button runs, reads results back, and can create cart proposals.

High-stakes actions need **exact spoken phrases** — a fuzzy "yeah okay sure" doesn't move money-adjacent state:

| To do this | You must say |
| :--- | :--- |
| Approve pending cart changes | `approve all changes` |
| Reject pending cart changes | `reject all changes` |
| Confirm your shopping plan | `confirm shopping plan` |

Confirming a plan still never submits payment. You can interrupt the agent, mute, ask it to repeat the screen, or end the session at any point.

Source: [`src/voice/tools.ts`](src/voice/tools.ts) · [`src/voice/realtimeAgent.ts`](src/voice/realtimeAgent.ts)

---

## Where the data comes from (provenance)

I care about this more than any feature, so it gets its own section.

**On the live path, every product fact is reconstructed server-side from Shopify's response.** The model contributes exactly two things: which variant IDs made the shortlist, and the prose explaining why. Titles, prices, currencies, merchants, images, and checkout links are never model-written.

**Warmed demo snapshots.** Judges and first-time visitors get about 30 seconds of attention, and a cold live agent run takes 10–30 seconds of it. So the three default answer paths (one per category) have **pre-captured snapshots in [`public/demo-cache/`](public/demo-cache)** — and I want to be precise about what those are:

- They are **real results from real live searches**. I ran the genuine OpenAI → Shopify pipeline via [`scripts/captureDemoCache.ts`](scripts/captureDemoCache.ts) and saved exactly what came back — real merchants, real Shopify CDN images, real checkout URLs.
- They replay in **~2 seconds**, with the connecting → searching → verifying beat still visible, because instant results look *more* fake, not less.
- **Any deviation from the default path falls straight through to the real live search.** Change one answer and you're on the live pipeline again.
- They are a **snapshot in time** — prices and availability from capture day. Re-run `npx tsx scripts/captureDemoCache.ts` and redeploy to refresh.

**What is never faked:** static catalog JSON in `src/data/` exists only for isolated ranking tests and one explicitly-named demo adapter. Live product lookup, results, cart actions, highlighting, and voice lookup accept *current live products only*. There is no automatic demo fallback anywhere on the live path.

---

## Run it yourself

You need **Node 20.19+** (Vite 8's minimum) and an **OpenAI API key** with Responses API access.

```bash
git clone https://github.com/adetorojeremiahfadesayo/co-cart.git
cd co-cart
npm install

cp .env.example .env      # then put a real OPENAI_API_KEY inside
npm run dev
```

Open **http://localhost:5173**.

Vite runs a dev-only middleware for `/api/search` and `/api/realtime-session`, so the API key lives on the server side even in development and is never bundled into the browser.

> ⚠️ **Never create `VITE_OPENAI_API_KEY`.** Anything prefixed `VITE_` is inlined into the client bundle and shipped to every visitor. The key belongs in `OPENAI_API_KEY`, server-side, full stop.

**Refresh the warmed demo snapshots** (makes 3 real, billed searches):

```bash
npx tsx scripts/captureDemoCache.ts
```

---

## Configuration

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | **Required.** Server-side only. | — |
| `OPENAI_MODEL` | Model for the shopping agent | `gpt-5.6` |
| `OPENAI_REALTIME_MODEL` | Model for hands-free voice | `gpt-realtime-2.1` |
| `COCART_SEARCH_RATE_LIMIT` | Live searches per client per 10 min | `5` |
| `COCART_MAX_CONCURRENT_SEARCHES` | Concurrent searches server-wide | `8` |
| `COCART_REALTIME_RATE_LIMIT` | Realtime session creations per client | conservative |

Beyond those, the server enforces limits that aren't configurable on purpose: **same-origin only**, a **16 KB** request ceiling, a **90-second** search timeout, and a hard **six-call Shopify safety limit** per search. An agent that wanders gets stopped by the server, not by a prompt asking it nicely.

---

## Deploy

Live at **https://co-cart-live.netlify.app** on Netlify's free plan — the static frontend and both API endpoints (`/api/search`, `/api/realtime-session`) run as Netlify Functions, mapped by redirects in [`netlify.toml`](netlify.toml).

```bash
npm i -g netlify-cli
netlify login
netlify sites:create --name your-site-name
netlify env:set OPENAI_API_KEY "sk-..."
netlify deploy --build --prod
```

The functions bundle straight from `netlify/functions/` with no porting — `server/liveSearch.ts` is plain Web-standard `Request`/`Response`, so the same handler runs under Vite's dev middleware, under Netlify, and under the capture script.

---

## Testing

```bash
npm run typecheck   # tsc -b
npm run lint        # oxlint
npm test            # vitest  → 35 tests, 6 files
npm run build       # tsc -b && vite build
```

The suite is written as a **spec for the trust boundary**, so the test names read like promises:

```text
✓ forces the live search function and reconstructs facts from Shopify MCP output
✓ requires a successful search_catalog call even if OpenAI asks for another Shopify function
✓ rejects a model selection that is absent from Shopify output
✓ rejects malformed agent function arguments before calling Shopify
✓ rejects cross-origin attempts before spending API tokens
✓ stops with an explicit 503 when the server key is missing
✓ rate-limits repeated public searches
✓ retries one transient upstream fetch failure

✓ never changes the confirmed cart when a proposal is rejected
✓ rejects seeded demo products from active cart actions
✓ discards completion from a stale search after the category changes
✓ keeps currency totals separate
✓ treats missing allergen metadata as unknown rather than safe

✓ keeps an agent cart change pending until the exact approval phrase
✓ cannot confirm a plan while proposals are unresolved
✓ creates a scoped Realtime client secret without exposing the server key
```

That last store test — *"treats missing allergen metadata as unknown rather than safe"* — is a small line with a big principle behind it. Absence of an allergen warning is not evidence of absence. For food, guessing optimistically is the one bug you genuinely cannot ship.

---

## Engineering notes — things I got wrong first

**The fallback was the most dangerous code I wrote.** Version one caught every exception and quietly served seeded products. It felt resilient. It was the worst thing in the repo: a broken OpenAI call and a successful one produced *identical-looking* screens. I couldn't tell live from fake during my own testing, so nobody else could either. The fallback is gone. The live path now fails loudly with a specific, recoverable message. If you can't tell whether a demo is real, it isn't.

**Letting the model describe products was the second mistake.** The obvious design is to ask for a nice JSON shortlist with titles and prices. It works, right up until you diff it against the Shopify response and find prices drifting by a few dollars — not hallucinated exactly, just *smoothed*. Now the model returns IDs and prose only, and the server rebuilds every fact. This is also why `parallel_tool_calls` is off: sequential calls make the evidence chain auditable.

**Currency ruined a perfectly good subtotal.** Shopify's global catalog returned a $13.99 pouch and a ₦21,900 pouch in the same shortlist and my cart cheerfully summed them. The fix wasn't picking a currency — it was accepting that a cart can hold several and rendering them separately. Multi-currency is a real shopping problem I nearly papered over with `.toFixed(2)`.

**Stale searches used to overwrite fresh ones.** Switch category mid-search, and the old request would land and repopulate the screen with the wrong domain's results. Every search now carries an ID and completion is dropped if it's been superseded. `discards completion from a stale search after the category changes` is that bug, pinned in a test so it can't come back.

**An untrusted product description is untrusted input.** Product text comes from third-party merchants and flows into a model's context. The agent is instructed to treat catalog text as data, never instructions — and more importantly it *can't act* on instructions anyway: its only capabilities are the strict `shopify_*` functions the server validates. Prompt injection has nowhere to land.

**I built a beautiful panel showing off the 13 agent tools. Then I deleted it.** A banner, a header button, a modal listing every tool with its last invocation. Genuinely nice UI. But it turned "this page works for agents" into a *feature to be admired* rather than infrastructure that simply exists. Real agent-ready pages won't carry a badge announcing it, the same way sites don't advertise their `robots.txt`. The tools stayed; the theatre went. The instinct to show your work belongs in the README, not in the product surface.

**Making the demo fast almost made it dishonest.** My first cache returned results in ~0 ms and it looked *worse* — a shortlist that materialises instantly reads as hardcoded. Keeping the staged progress beat (~2 s) and falling through to the real search on any off-script answer is what makes fast and honest the same thing.

---

## Project layout

```text
co-cart/
├─ src/
│  ├─ webmcp/tools.ts        ← the 13 agent tools, audited + guarded
│  ├─ voice/                 ← Realtime agent, spoken tool surface, events
│  ├─ agent/
│  │  ├─ liveSearch.ts       ← NDJSON stream client + warmed-cache replay
│  │  ├─ demoCache.ts        ← which answer paths have snapshots
│  │  └─ searchCoordinator.ts← one search at a time, cancellable
│  ├─ decision/
│  │  ├─ questions.ts        ← the six cards per category + validation
│  │  ├─ country.ts          ← free-text address → shipping country
│  │  └─ ranking.ts          ← explainable ranking (test-only fixtures)
│  ├─ store/useStore.ts      ← Zustand: cart vs proposals, per-currency totals
│  ├─ components/            ← decision deck, live results, cart, voice panel
│  └─ index.css + tokens.css ← the design system
├─ server/
│  ├─ liveSearch.ts          ← the agent loop, guards, fact reconstruction
│  ├─ shopifyMcp.ts          ← strict function schemas + JSON-RPC executor
│  └─ *.test.ts              ← the trust-boundary spec
├─ netlify/functions/        ← thin wrappers over the same handlers
├─ scripts/captureDemoCache.ts
└─ public/demo-cache/        ← real captured results, 3 domains
```

---

## Honest limitations

Because a README that only lists strengths isn't worth reading:

- **The delivery address is demo-grade.** Shopify's catalog filter takes a *country*, not a street. The field accepts free text and derives the country from it — which is exactly what every checkout does, but it isn't validating that your street exists.
- **The warmed snapshots age.** Real data, captured on a specific day. Re-capture before a demo that matters.
- **WebMCP is still a proposal.** `navigator.modelContext` isn't in stable browsers yet, so the tool surface only lights up in a WebMCP-enabled host. That's a bet on where the web is going, and I'm comfortable making it.
- **Tools are browser-side only.** A headless agent that never loads the page sees nothing. A server-side MCP endpoint is the obvious next build.
- **The shortlist caps at six.** Deliberate — the whole point is reducing choice — but it means Co-Cart is a decision tool, not a search engine.
- **Live searches cost real money.** Every **Go** is a billed OpenAI run. Hence the rate limits, the concurrency cap, and the six-call ceiling.

---

## License

MIT — see [LICENSE](LICENSE). Take it apart, learn from it, build something better.

<div align="center">

**Built because an AI told me about three pairs of headphones that didn't exist.**

[Live app](https://co-cart-live.netlify.app) · [Report an issue](https://github.com/adetorojeremiahfadesayo/co-cart/issues)

</div>
