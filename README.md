<div align="center">

# 🂡 Houseruled

### Your rules. Your game. Any deck.

A free-forever card table you play with friends over a link.
Bring the deck, bring your house rules — no app store, no account, no catch.

</div>

---

Every table has that one person who says *"actually, at my house, twos are wild."*
Houseruled is built for them. Start a game, share a six-letter code, and bend the
rules however your table likes — the felt does the rest.

It runs entirely on **one platform, one free tier, forever** — Cloudflare, top to
bottom. No servers to babysit, no second dashboard, no bill at the end of the month.

## Where it's at

Houseruled is built in deliberate phases — each one playable before the next begins.

| Phase | What | Status |
| :---- | :--- | :----: |
| 0 | Scaffolding — rooms, join-by-link, the felt table | ✅ |
| 1 | The engine + 10 built-in games (shedding + trick-taking) | ✅ |
| 2 | Toggle-based house rules (curated, pre-built) | ✅ |
| 3 | Free-text AI house rules (*"queens reverse direction"*) | ✅ |
| 4 | Whole games invented from a sentence | ✅ |
| 5 | Community library, sharing, spectators, chat | ✅ |

**Today you can:** spin up a table, share the code, and **play** — **10 games** so
far — live over WebSockets. Toggle curated **house rules**, or just *type your own
in plain English* and the AI turns it into a real rule. You can even **describe a
whole game in a sentence** and play what it invents — then save it to the community
library.

### The games

Every game runs **server-authoritatively inside the room's Durable Object** — it
owns the deck, validates every move, and sends each player only their own hand.

- **Shedding / matching:** War, Go Fish, Old Maid, Crazy Eights, Blackjack, Cheat (Bluff)
- **Trick-taking** (shared trick core — follow-suit, trump, bidding): Hearts, Spades, Euchre (partnerships + bowers), Oh Hell (exact bids)

The engine is pure, shared TypeScript with a big test suite (80+ tests —
randomized playthroughs that conserve every card and always terminate).

### House rules (Phase 2)

Before a game, the host toggles curated, pre-validated rules (10 for Crazy Eights
alone). Mutually-exclusive rules and unmet dependencies are caught and surfaced —
never silently resolved — so the table agrees before the first card is dealt.

### Free-text AI rules (Phase 3)

Type a rule in plain English — *"twos are wild"*, *"queens reverse"*, *"playing a
7 lets you go again"* — and **Groq (Llama 3.3 70B)** maps it to a strict, validated
rule object that the deterministic engine executes. Rules can be added before the
deal or **live mid-game** (the whole table sees the change). The model output is
never trusted directly: it's validated into a bounded effect vocabulary, and every
parse is cached in KV so a common rule hits the model once, ever. A live prompt
suite guards regressions.

### Invent a game (Phase 4)

Describe a game in a sentence and the AI designs it — picking the closest base
game and writing the house rules — then shows you a review card before you play.
Save it to the **community library** and share a `/game/<slug>` link.

### Library, sharing & the table (Phase 5)

A D1-backed community library (browse, most-played), shareable game links,
live **table chat**, spectators (late joiners watch), and reconnect-safe rooms
(state lives in the Durable Object). Optional accounts and more games (Gin Rummy,
Cribbage, Scopa, real-time Speed/Egyptian Ratscrew, solo Solitaire, …) are the
next things on deck.

## The free-forever table — all Cloudflare

| Layer | Runs on | Why it's free |
| :---- | :------ | :------------ |
| App + hosting | **Cloudflare Workers** (via OpenNext) | Generous free tier, global edge |
| Live rooms + authoritative games | **Durable Objects** + WebSockets | One DO *is* a room; SQLite-backed DOs are on the free plan, and hibernation means idle rooms cost nothing |
| Community library | **Cloudflare D1** (SQLite) | 5 GB free — a *lot* of saved games |
| AI rule cache | **Cloudflare KV** | Common rules hit the model once, ever |
| AI rules + game design | **Groq** (Llama 3.3 70B) | Free, no card required |

There's no separate database or realtime service to sign up for. **Each room is a
Durable Object**, addressed by its code — it holds the room's state and every
connected player's WebSocket, and relays presence + game deltas between them. When
the room empties, the DO hibernates and bills nothing.

> **On "Cloudflare Pages":** the modern way to ship Next.js to Cloudflare is the
> OpenNext adapter targeting **Workers with Static Assets** — the successor to the
> old Pages/`next-on-pages` path. Same free story, current tooling.

## Play locally in 60 seconds

```bash
git clone <your-fork-url> houseruled
cd houseruled
npm install
npm run dev        # local "table demo" — no backend needed
```

Open [localhost:3000](http://localhost:3000) and hit **Start a table**. Plain
`next dev` has no Worker, so it runs a local single-seat demo — you see the felt,
just not live friends.

To run the **real** thing locally (Durable Object + WebSockets), use the Workers
runtime:

```bash
npm run preview    # opennextjs-cloudflare build + wrangler dev
```

Now open two browser windows on the same table code — the second player appears at
the table live.

## Shipping it to the edge

```bash
npm run deploy     # OpenNext build → wrangler deploy (Worker + Durable Object)
```

First-time setup:

```bash
wrangler login                                   # once

# Library (saved custom games)
wrangler d1 create houseruled                    # paste the id into wrangler.jsonc → d1_databases
wrangler d1 migrations apply houseruled --remote

# AI rules + game design (Phase 3/4)
wrangler kv namespace create RULE_CACHE          # paste the id into wrangler.jsonc → kv_namespaces
echo "gsk_your_groq_key" | wrangler secret put GROQ_API_KEY   # free at console.groq.com

npm run deploy
```

You get a `houseruled.<subdomain>.workers.dev` URL with real, shareable
multiplayer. The core games need no env vars; the AI features need the Groq
secret + KV. (Set `NEXT_PUBLIC_SITE_URL` to your final URL for correct SEO tags.)

> The `GROQ_API_KEY` is a **Worker secret** — it stays server-side and never
> reaches the browser. AI calls happen in route handlers and the Durable Object.

## Tests & CI/CD

```bash
npm run test           # unit tests (Vitest)
npm run test:coverage  # with coverage
npm run typecheck      # tsc for the app + the Worker (separate type worlds)
```

Every push and PR runs **typecheck → tests → build** via GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). When `main` is green it
applies D1 migrations and deploys to Cloudflare. Add these repo settings for the
deploy job:

- **Secrets** — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Variables** — `NEXT_PUBLIC_SITE_URL` (and optionally the AdSense vars)

## Also an app 📱

Houseruled is built mobile-first and ships as an **installable PWA** today — on
iOS or Android, *Add to Home Screen* gives a full-screen, standalone app with its
own icon and no browser chrome. That's the truly free path to "an app."

A native **iOS + Android** build is on the roadmap via
[Capacitor](https://capacitorjs.com), which wraps this same web build in a native
shell — one codebase, real App Store / Play Store presence.

> Heads up on "free-forever": the *code* stays free, but the app stores don't —
> Apple's Developer Program is **$99/year** and Google Play is a **$25** one-time
> fee. The PWA route sidesteps both.

## Ads & support

Houseruled stays free with a single, quiet ad slot (well off the felt) and an
optional "buy me a coffee" link — nothing that gets in the way of a hand. Ads are
**fully opt-in**: with no `NEXT_PUBLIC_ADSENSE_CLIENT` set, no script loads and no
empty boxes render.

## Design notes

The guiding idea: **the felt is the interface.** Personality comes from a deep,
saturated forest-green surface with brass accents — a warm card table, not a
dashboard that happens to have cards on it. Chrome stays quiet; the one place we
spend visual budget is the **house-rules plaque**, a little brass-trimmed scorecard
pinned to the felt.

- **Palette** — felt green, cream card faces, brass trim, a sparing ember red.
- **Type** — [Fraunces](https://fonts.google.com/specimen/Fraunces) for titles and
  room codes, Inter for everything you actually read.
- **Motion** — physical, tactile, brief. One theatrical moment (the deal) arrives
  with Phase 1. Everything honors `prefers-reduced-motion`.

## Under the hood

```
worker.ts             # custom Worker entry: routes /api/room/* (+ WebSockets) to the DO
src/
  server/room-do.ts   # RoomDO Durable Object — a room's state + presence + relay
  app/                # routes: landing, /room/[code], manifest, icons, sitemap, robots
  components/         # Wordmark, FeltTable, PlayerSeat, HouseRulesPlaque, …
  lib/                # room lifecycle (REST → DO), anon identity, realtime (WS), code gen
migrations/           # D1 (SQLite) schema for the library + accounts
```

- **No accounts required.** A player is a random id + a name in `localStorage`.
- **Rooms are Durable Objects**, not database rows — a room lives as long as it
  holds state, and hibernates when empty.
- **Graceful demo mode** under `next dev`, so the felt always comes up.

*Curious why not Rust? The whole stack is managed Cloudflare services + a
design-heavy React UI — nothing here is compute-bound, and the AI rules engine
(Phase 3) is inherently JSON-shaped, so TypeScript keeps it all in one language
with no WASM boundary. If a hot path ever appears, the deterministic rule engine
is the one piece worth revisiting in Rust.*

---

<div align="center">

**Bring the deck. We'll keep the felt.**

</div>
