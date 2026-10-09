// One source of truth for Houseruled's prose pages. Each SiteDoc renders twice:
// as HTML through <ProsePage> (the Next routes) and as Markdown through
// docToMarkdown (the agent gateway, for `Accept: text/markdown`). Inline text
// uses a tiny Markdown subset - [links](/path), **bold**, `code` - that both
// renderers understand, so the two representations can't drift apart.

import { GAME_CATALOG } from "../lib/engine/registry";
import { GUIDES } from "../lib/engine/guides";
import { CONTACT_EMAIL, REPO_URL, SITE_URL } from "../lib/env";

export type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; lang?: string; text: string };

export interface SiteDoc {
  path: string;
  /** <title> (the layout appends " · Houseruled"). */
  title: string;
  description: string;
  /** The page's single H1. */
  heading: string;
  lede: string;
  blocks: Block[];
}

export const MCP_PATH = "/mcp";
const UPDATED = "October 8, 2026";

function players(min: number, max: number): string {
  if (min === max) return `${min} players`;
  return min === 1 ? `1 to ${max} players` : `${min} to ${max} players`;
}

/** "War (2 players): Flip cards, high card wins..." for each built-in game. */
export function gameLines(): string[] {
  return GAME_CATALOG.map((g) => `**${g.name}** (${players(g.minPlayers, g.maxPlayers)}): ${g.blurb}`);
}

// ── Home (Markdown only; the HTML home is the interactive page.tsx) ───────────
export function homeDoc(): SiteDoc {
  return {
    path: "/",
    title: "Houseruled: free online card games with your house rules",
    description:
      "Houseruled is a free multiplayer card table in the browser. Start a table, share a link, and play 16 classic card games with friends using your own house rules.",
    heading: "Houseruled: free online card games with your house rules",
    lede:
      "Houseruled is a free, no-download card table you play with friends over a link. Start a table, share the six-letter room code, pick a game, and switch on the house rules your family actually plays by. There is no app to install and no account to create.",
    blocks: [
      { type: "h2", text: "How a game night works" },
      {
        type: "ul",
        items: [
          "**Start a table** on the homepage. You get a room code and a share link.",
          "**Friends join** by opening the link or typing the code. Everyone plays from their own phone or laptop.",
          "**Pick a game and set house rules.** Toggle curated variants (\"twos draw two\", \"dealer hits soft 17\") or type a rule in plain English for Crazy Eights.",
          "**Deal.** The table runs live over WebSockets: turns, hands, chat, and rematches.",
        ],
      },
      { type: "h2", text: `${GAME_CATALOG.length} card games ready to deal` },
      { type: "ul", items: gameLines() },
      { type: "h2", text: "Invent a game with AI" },
      {
        type: "p",
        text: "Describe a card game in a sentence on [Invent](/invent) and Houseruled builds a playable ruleset on top of War, Go Fish, Old Maid, Crazy Eights, or Blackjack. Save it to the [community library](/games) so anyone can play it.",
      },
      { type: "h2", text: "For AI agents and developers" },
      {
        type: "ul",
        items: [
          "[llms.txt](/llms.txt): when to use Houseruled and how to call it.",
          `[MCP server](${MCP_PATH}): Streamable HTTP endpoint with tools for the game catalog, rules, and community library.`,
          "[Developer docs](/developers): MCP setup, the public read API, and the [OpenAPI spec](/openapi.json).",
          "[About](/about), [Contact](/contact), and [Privacy](/privacy).",
        ],
      },
    ],
  };
}

// ── Trust anchor pages ───────────────────────────────────────────────────────
export const ABOUT: SiteDoc = {
  path: "/about",
  title: "About Houseruled",
  description:
    "Why Houseruled exists: a free-forever online card table for playing classic card games with friends, using the house rules your table already plays by.",
  heading: "About Houseruled",
  lede:
    "Houseruled is a free online card table for playing classic card games with friends over a link. It exists because every family plays Crazy Eights a little differently, and most card apps make you play their way.",
  blocks: [
    { type: "h2", text: "What it is" },
    {
      type: "p",
      text: `Houseruled runs ${GAME_CATALOG.length} classic card games in the browser, from War and Go Fish to Hearts, Euchre, Cribbage, and 500. One person starts a table and shares a link; everyone else joins from their own device. Before the deal, the host picks the house rules: curated toggles for each game, plain-English rules for Crazy Eights, or a whole new game invented with AI and saved to the community library.`,
    },
    { type: "h2", text: "What we promise" },
    {
      type: "ul",
      items: [
        "**Free forever.** No paywalled games, no premium tier, no loot boxes. The project is funded by optional donations.",
        "**No account required.** You get an anonymous player id in your browser. Pick any display name.",
        "**Your rules win.** House rules are first-class, not a hidden settings menu.",
        "**Open source.** The full code is public under the MIT license on [GitHub](" + REPO_URL + ").",
      ],
    },
    { type: "h2", text: "Who builds it" },
    {
      type: "p",
      text: `Houseruled is an independent project built and maintained by Karthik Subramanian in Berkeley, California. It runs on Cloudflare Workers, Durable Objects (one per live table), D1, and KV. Questions, bug reports, and partnership requests go to [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) or [GitHub issues](${REPO_URL}/issues); see [Contact](/contact).`,
    },
  ],
};

export const CONTACT: SiteDoc = {
  path: "/contact",
  title: "Contact Houseruled",
  description:
    "How to reach the Houseruled maintainer: email for support, privacy, and partnership questions, and GitHub issues for bugs and rule requests.",
  heading: "Contact Houseruled",
  lede:
    "Houseruled is maintained by one person, in public. These are the fastest ways to get a reply, whether you found a bug, want a game added, or are wiring an agent into the MCP server.",
  blocks: [
    { type: "h2", text: "Email" },
    {
      type: "ul",
      items: [
        `Support, privacy, and partnerships: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`,
        "Put \"Houseruled\" in the subject line so it gets routed quickly. Expect a reply within a few days.",
      ],
    },
    { type: "h2", text: "GitHub" },
    {
      type: "ul",
      items: [
        `Bugs and feature requests: [GitHub issues](${REPO_URL}/issues). Include the game, the house rules you had on, and what happened.`,
        `Source code and pull requests: [${REPO_URL.replace("https://", "")}](${REPO_URL}).`,
      ],
    },
    { type: "h2", text: "For agent and app developers" },
    {
      type: "p",
      text: "Start with [llms.txt](/llms.txt) and the [developer docs](/developers). The MCP server and the read API are public and need no key. If you plan to send meaningful traffic, email first so rate limits can be set sensibly.",
    },
    { type: "h2", text: "Mailing address" },
    {
      type: "p",
      text: "Houseruled, Berkeley, California, United States. There is no phone support; email is the reliable channel.",
    },
  ],
};

export const PRIVACY: SiteDoc = {
  path: "/privacy",
  title: "Privacy policy",
  description:
    "What data Houseruled stores, why, and for how long: an anonymous player id, your display name, saved games, and the house rules you send for AI parsing.",
  heading: "Houseruled privacy policy",
  lede: `Houseruled is designed to need as little about you as possible: no account, no email, no real name. This page lists everything the service stores and why. Last updated ${UPDATED}.`,
  blocks: [
    { type: "h2", text: "What stays in your browser" },
    {
      type: "p",
      text: "On first visit your browser generates a random player id, a display name, and a secret token, stored in localStorage. They let you rejoin a table and keep your saved games tied to you. Clearing site data resets them.",
    },
    { type: "h2", text: "What the service stores" },
    {
      type: "ul",
      items: [
        "**Live tables:** each room keeps its code, seats, display names, and game state in a Cloudflare Durable Object while the game runs. Chat is relayed live to the table and is not stored.",
        "**Public profiles and the library:** if you save a game, its title, description, rules, and your display name and player id are stored in Cloudflare D1 and shown publicly. Favorites are stored by player id.",
        "**Player auth:** a one-way hash of your secret token, so nobody else can post as your player id.",
        "**Rate limiting:** short-lived counters keyed by IP address in Cloudflare KV, expiring within two days.",
      ],
    },
    { type: "h2", text: "AI features" },
    {
      type: "p",
      text: "When you type a house rule or describe a game to invent, that text is sent to Groq to turn it into a structured rule. Parsed rules are cached by a hash of the normalized text so common rules are not sent twice. Do not type personal information into rule boxes.",
    },
    { type: "h2", text: "Logs, ads, and third parties" },
    {
      type: "p",
      text: "Cloudflare processes requests and keeps standard operational logs. If advertising is enabled, Google AdSense may set cookies under Google's own policy; ads are off unless configured. The \"Buy me a coffee\" link leaves Houseruled for buymeacoffee.com. We do not sell data or use analytics trackers.",
    },
    { type: "h2", text: "Your choices" },
    {
      type: "p",
      text: `To delete a saved game or profile, email [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) with your player id (shown on your profile page) and it will be removed. Houseruled is not directed at children under 13.`,
    },
  ],
};

// ── Developer docs (predictable URL for "Houseruled API / MCP" searches) ──────
export const DEVELOPERS: SiteDoc = {
  path: "/developers",
  title: "Houseruled developer docs: MCP server and API",
  description:
    "Connect AI agents to Houseruled: a public Streamable HTTP MCP server and read-only JSON API for card game rules, house-rule variants, and the community game library.",
  heading: "Houseruled developer docs: MCP server and API",
  lede:
    "Houseruled exposes its card game catalog, rules, house-rule variants, and community library to agents through a public MCP server and a small JSON API. Both are read-only and need no API key.",
  blocks: [
    { type: "h2", text: "MCP server" },
    {
      type: "p",
      text: `Endpoint: \`${MCP_PATH}\` (Streamable HTTP, stateless, JSON responses). It supports MCP protocol 2026-07-28 (\`server/discover\`) and legacy clients that send \`initialize\` (2025-03-26 through 2025-11-25). Its MCP Server Card is at [/mcp/server-card](/mcp/server-card), and domain-level discovery is at [/.well-known/ai-catalog.json](/.well-known/ai-catalog.json).`,
    },
    { type: "h3", text: "Tools" },
    {
      type: "ul",
      items: [
        "`list_games`: every built-in game with player counts, a one-line summary, and whether it accepts free-text house rules.",
        "`get_game_rules`: goal, step-by-step rules, a tip, and the curated house-rule variants for one game.",
        "`search_community_games`: search player-invented games in the community library by text or base game.",
        "`get_community_game`: one saved community game with its full house rules and a play link.",
      ],
    },
    { type: "h3", text: "Connect a client" },
    {
      type: "code",
      lang: "json",
      text: `{\n  "mcpServers": {\n    "houseruled": { "type": "http", "url": "${SITE_URL}${MCP_PATH}" }\n  }\n}`,
    },
    { type: "h2", text: "JSON API" },
    {
      type: "ul",
      items: [
        "`GET /api/games?search=&base=&sort=plays|new`: list community games.",
        "`GET /api/games/{slug}`: one community game, or 404.",
        "Machine-readable spec: [/openapi.json](/openapi.json) (OpenAPI 3.1).",
      ],
    },
    { type: "h2", text: "Markdown for agents" },
    {
      type: "p",
      text: "Every public page answers `Accept: text/markdown` with a Markdown version (and `Vary: Accept`). Unknown paths return a Markdown 404. See [llms.txt](/llms.txt) for the full index.",
    },
    { type: "h2", text: "Limits and terms" },
    {
      type: "p",
      text: "Be gentle: the service is free and runs on a hobby budget. AI rule parsing is rate limited per IP. Write endpoints exist for the web client but are not part of the public agent surface. Questions go to [Contact](/contact).",
    },
  ],
};

// ── Markdown-only docs for interactive pages ────────────────────────────────
export const INVENT_DOC: SiteDoc = {
  path: "/invent",
  title: "Invent a game",
  description: "Describe a card game in a sentence and let the AI build it, then play it with friends.",
  heading: "Invent a card game with AI",
  lede: "Describe a card game in a sentence and Houseruled turns it into a playable ruleset on top of a base game, then deals it at a live table you can share with friends.",
  blocks: [
    { type: "h2", text: "How it works" },
    {
      type: "ul",
      items: [
        "Pick a base: War, Go Fish, Old Maid, Crazy Eights, or Blackjack.",
        "Describe your twist in plain English, for example \"sevens reverse direction and jacks make everyone draw one\".",
        "Houseruled parses it into structured house rules, explains them back, and lets you deal immediately.",
        "Save it to the [community library](/games) so other tables can play it.",
      ],
    },
    { type: "p", text: "This page is interactive and needs a browser. Agents can browse existing inventions with the MCP tool `search_community_games`; see [developer docs](/developers)." },
  ],
};

export function libraryMarkdown(
  games: { slug: string; title: string; baseGame: string; explanation: string; plays: number }[],
  siteUrl: string,
): string {
  const nameOf = (type: string) => GAME_CATALOG.find((g) => g.type === type)?.name ?? type;
  const community = games.length
    ? games.map((g) => `- [${g.title}](/game/${g.slug}) (on ${nameOf(g.baseGame)}, ${g.plays} plays): ${g.explanation}`).join("\n")
    : "No community games yet. Be the first to [invent one](/invent).";
  return docToMarkdown(
    {
      path: "/games",
      title: "Games",
      description: "",
      heading: "Houseruled games library",
      lede: "Every built-in card game on Houseruled, plus games invented by players and saved to the community library.",
      blocks: [
        { type: "h2", text: "Built-in games" },
        { type: "ul", items: gameLines() },
        { type: "h2", text: "Community games" },
        { type: "p", text: community },
      ],
    },
    siteUrl,
  );
}

export function communityGameMarkdown(
  g: { slug: string; title: string; baseGame: string; explanation: string; ruleTexts: string[]; plays: number; creatorName: string | null },
  siteUrl: string,
): string {
  const base = GAME_CATALOG.find((c) => c.type === g.baseGame)?.name ?? g.baseGame;
  return docToMarkdown(
    {
      path: `/game/${g.slug}`,
      title: g.title,
      description: "",
      heading: `${g.title}: a Houseruled community game`,
      lede: g.explanation || `A house-ruled variant of ${base}.`,
      blocks: [
        { type: "ul", items: [`Base game: ${base}`, `Plays: ${g.plays}`, ...(g.creatorName ? [`Created by ${g.creatorName}`] : [])] },
        { type: "h2", text: "House rules" },
        g.ruleTexts.length ? { type: "ul", items: g.ruleTexts } : { type: "p", text: `Standard ${base} rules.` },
        { type: "h2", text: "Play it" },
        { type: "p", text: `Open [this game](/game/${g.slug}) in a browser and press Play to deal a table with these rules, then share the link with friends.` },
      ],
    },
    siteUrl,
  );
}

export const PROSE_DOCS: readonly SiteDoc[] = [ABOUT, CONTACT, PRIVACY, DEVELOPERS];

// ── Markdown rendering ───────────────────────────────────────────────────────
/** Root-relative links become absolute: agents often fetch Markdown out of context. */
export function absolutize(text: string, siteUrl: string): string {
  return text.replace(/\]\((\/[^)]*)\)/g, (_m, path: string) => `](${siteUrl}${path === "/" ? "" : path})`);
}

export function docToMarkdown(doc: SiteDoc, siteUrl: string): string {
  const out: string[] = [`# ${doc.heading}`, doc.lede];
  for (const b of doc.blocks) {
    if (b.type === "h2") out.push(`## ${b.text}`);
    else if (b.type === "h3") out.push(`### ${b.text}`);
    else if (b.type === "p") out.push(b.text);
    else if (b.type === "ul") out.push(b.items.map((i) => `- ${i}`).join("\n"));
    else out.push(`\`\`\`${b.lang ?? ""}\n${b.text}\n\`\`\``);
  }
  out.push(`---\n\n[Home](/) · [Games](/games) · [About](/about) · [Contact](/contact) · [Privacy](/privacy) · [Developers](/developers) · [llms.txt](/llms.txt)`);
  return absolutize(out.join("\n\n"), siteUrl) + "\n";
}

export function notFoundMarkdown(path: string, siteUrl: string): string {
  return absolutize(
    [
      "# 404: page not found",
      `There is no page at \`${path}\` on Houseruled. It may have moved, or the room code may be mistyped.`,
      "Try one of these instead:",
      "- [Home](/): start or join a card table\n- [Games library](/games)\n- [llms.txt](/llms.txt): index of everything an agent can read\n- [Sitemap](/sitemap.xml)\n- [Developer docs](/developers)",
    ].join("\n\n"),
    siteUrl,
  ) + "\n";
}

// ── llms.txt (https://llmstxt.org) ───────────────────────────────────────────
export function llmsTxt(siteUrl: string): string {
  const games = GAME_CATALOG.map((g) => g.name).join(", ");
  const md = `# Houseruled

> Houseruled is a free, no-download online card table at ${siteUrl}. Friends join a table over a link and play ${GAME_CATALOG.length} classic card games (${games}) with their own house rules. It also offers a public MCP server and read-only API for card game rules and a community library of player-invented games.

Houseruled is free forever, needs no account, and is open source (MIT). Tables are live multiplayer rooms identified by a six-letter code; a human starts a table from the homepage and shares the link.

## When to use this

- Use Houseruled when a person wants to **play a card game with friends remotely** right now, in a browser, with no install or sign-up. Send them to ${siteUrl}/ and tell them to press "Start a table" and share the link.
- Use Houseruled when you need **the rules of a classic card game** (${games}): call the MCP tool \`get_game_rules\` or read the game list on the homepage Markdown.
- Use Houseruled when a person wants to **play with house rules or variants** ("twos draw two", "dealer hits soft 17", stacking draws). \`get_game_rules\` lists the curated variants per game; Crazy Eights also accepts rules in plain English.
- Use Houseruled when a person wants to **invent a new card game**: point them to ${siteUrl}/invent, or search existing inventions with \`search_community_games\`.
- Do not use Houseruled for real-money gambling, casino odds, poker tournaments, or as a game-state API for bots to play hands; agents cannot sit at tables.

## How to call it

- MCP (Streamable HTTP, no auth): \`POST ${siteUrl}${MCP_PATH}\`. Tools: \`list_games\`, \`get_game_rules\`, \`search_community_games\`, \`get_community_game\`.
- Any page as Markdown: send \`Accept: text/markdown\`.
- JSON API: \`GET ${siteUrl}/api/games\` and \`GET ${siteUrl}/api/games/{slug}\` ([OpenAPI](/openapi.json)).

## Docs

- [Homepage](/): what Houseruled is and every game it offers
- [Developer docs](/developers): MCP server, tools, client config, JSON API
- [OpenAPI spec](/openapi.json): read API schema
- [MCP Server Card](/mcp/server-card): MCP connection metadata (also indexed in [/.well-known/ai-catalog.json](/.well-known/ai-catalog.json))
- [Games library](/games): community-invented games
- [Invent a game](/invent): AI game builder

## Trust

- [About](/about): who builds Houseruled and what it promises
- [Contact](/contact): email ${CONTACT_EMAIL} and GitHub issues
- [Privacy](/privacy): exactly what is stored and why

## Optional

- [Source code](${REPO_URL}): Next.js on Cloudflare Workers, Durable Objects, D1
- [Sitemap](/sitemap.xml)
`;
  return absolutize(md, siteUrl);
}

/** Per-game guide, with the human-readable name, for the MCP rules tool. */
export function guideFor(type: string) {
  const meta = GAME_CATALOG.find((g) => g.type === type);
  const guide = GUIDES[type];
  return meta && guide ? { ...meta, ...guide } : null;
}
