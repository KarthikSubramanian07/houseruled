// Houseruled MCP server: Streamable HTTP transport, stateless, JSON responses.
// https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
//
// Two protocol eras are served from one endpoint:
//   - Modern (2026-07-28): no handshake. Every request carries its version and
//     client capabilities in params._meta; `server/discover` advertises us.
//   - Legacy (2025-03-26 .. 2025-11-25): `initialize` negotiates a version,
//     then plain requests follow. We never issue an Mcp-Session-Id, which the
//     spec allows, so every POST stands alone and any isolate can answer it.
//
// Every tool is read-only, so there is no auth; Origin is still validated
// (DNS-rebinding guard the transport spec requires).

import { GAME_CATALOG, supportsAIRules } from "../lib/engine/registry";
import { rulesFor } from "../lib/engine/houserules";
import { getCustomGame, listCustomGames, type LibraryEnv } from "../lib/library";
import { guideFor, MCP_PATH } from "./content";

export const MODERN_VERSIONS = ["2026-07-28"] as const;
export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const SUPPORTED_VERSIONS: readonly string[] = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];

const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CAPS = "io.modelcontextprotocol/clientCapabilities";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const MCP_ENDPOINT = MCP_PATH;

export const SERVER_INFO = {
  // Reverse-DNS, matching the Server Card `name` (they must not contradict).
  name: "io.github.KarthikSubramanian07/houseruled",
  title: "Houseruled",
  version: "1.0.0",
  description: "Card game rules, house-rule variants, and the Houseruled community game library.",
} as const;

export const INSTRUCTIONS =
  "Houseruled is a free browser card table for playing classic card games with friends over a link. " +
  "Use list_games to see the 16 built-in games, get_game_rules for how to play one plus its house-rule variants, " +
  "and search_community_games / get_community_game for player-invented games. Agents cannot sit at tables: to play, " +
  "send the person to the site's homepage (Start a table) or to a community game's playUrl.";

// JSON-RPC error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const UNSUPPORTED_VERSION = -32022;

type Id = string | number;
interface RpcRequest {
  jsonrpc: "2.0";
  id?: Id | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

export interface McpEnv extends LibraryEnv {
  [key: string]: unknown;
}

// ── Tools ────────────────────────────────────────────────────────────────────
const GAME_TYPES = GAME_CATALOG.map((g) => g.type);
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: "list_games",
    title: "List card games",
    description:
      "List every card game Houseruled can deal, with player counts, a one-line summary, and whether it accepts free-text house rules.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: "get_game_rules",
    title: "Get game rules",
    description:
      "How to play one built-in card game: the goal, step-by-step rules, a strategy tip, and the curated house-rule variants a host can switch on.",
    inputSchema: {
      type: "object",
      properties: {
        game: { type: "string", enum: GAME_TYPES, description: "Game id from list_games, e.g. \"crazyeights\"." },
      },
      required: ["game"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "search_community_games",
    title: "Search community games",
    description:
      "Search the community library of player-invented card games (custom house rules on top of a base game). Returns titles, explanations, play counts, and play links.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to match in titles and descriptions." },
        base: { type: "string", enum: GAME_TYPES, description: "Only games built on this base game." },
        sort: { type: "string", enum: ["plays", "new"], description: "Most played (default) or newest." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max results (default 10)." },
      },
      additionalProperties: false,
    },
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
  {
    name: "get_community_game",
    title: "Get a community game",
    description: "Fetch one saved community game by slug, including every house rule it adds and a link to play it.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug from search_community_games." } },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
] as const;

interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

function ok(data: unknown, summary?: string): ToolResult {
  return {
    content: [{ type: "text", text: summary ? `${summary}\n\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function callTool(name: string, args: Record<string, unknown>, env: McpEnv, siteUrl: string): Promise<ToolResult | null> {
  try {
    return await runTool(name, args, env, siteUrl);
  } catch {
    // Only the library tools touch D1; an outage is a tool error the model can read.
    return toolError("The community library is temporarily unavailable. Built-in games (list_games, get_game_rules) still work.");
  }
}

async function runTool(name: string, args: Record<string, unknown>, env: McpEnv, siteUrl: string): Promise<ToolResult | null> {
  switch (name) {
    case "list_games":
      return ok(
        {
          games: GAME_CATALOG.map((g) => ({
            id: g.type,
            name: g.name,
            minPlayers: g.minPlayers,
            maxPlayers: g.maxPlayers,
            summary: g.blurb,
            freeTextHouseRules: supportsAIRules(g.type),
          })),
          startUrl: `${siteUrl}/`,
        },
        `${GAME_CATALOG.length} games. To play, open ${siteUrl}/ and press "Start a table".`,
      );

    case "get_game_rules": {
      const game = typeof args.game === "string" ? args.game.toLowerCase() : "";
      const guide = guideFor(game);
      if (!guide) return toolError(`Unknown game "${game}". Valid ids: ${GAME_TYPES.join(", ")}.`);
      return ok({
        id: guide.type,
        name: guide.name,
        players: { min: guide.minPlayers, max: guide.maxPlayers },
        goal: guide.goal,
        steps: guide.steps,
        tip: guide.tip,
        houseRules: rulesFor(game).map((r) => ({
          id: r.id,
          label: r.label,
          description: r.description,
          ...(r.group ? { exclusiveGroup: r.group } : {}),
          ...(r.requires ? { requires: r.requires } : {}),
        })),
        freeTextHouseRules: supportsAIRules(game),
        startUrl: `${siteUrl}/`,
      });
    }

    case "search_community_games": {
      const base = typeof args.base === "string" && GAME_TYPES.includes(args.base) ? args.base : undefined;
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 10;
      const games = await listCustomGames(env, {
        search: typeof args.query === "string" ? args.query : undefined,
        base,
        sort: args.sort === "new" ? "new" : "plays",
        limit,
      });
      return ok({
        games: games.map((g) => ({
          slug: g.slug,
          title: g.title,
          baseGame: g.baseGame,
          explanation: g.explanation,
          plays: g.plays,
          creator: g.creatorName,
          playUrl: `${siteUrl}/game/${g.slug}`,
        })),
      });
    }

    case "get_community_game": {
      const slug = typeof args.slug === "string" ? args.slug : "";
      const game = slug ? await getCustomGame(env, slug) : null;
      if (!game) return toolError(`No community game with slug "${slug}". Use search_community_games to find one.`);
      return ok({
        slug: game.slug,
        title: game.title,
        baseGame: game.baseGame,
        explanation: game.explanation,
        houseRules: game.ruleTexts,
        plays: game.plays,
        creator: game.creatorName,
        playUrl: `${siteUrl}/game/${game.slug}`,
      });
    }

    default:
      return null;
  }
}

// ── JSON-RPC dispatch ────────────────────────────────────────────────────────
class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
    readonly httpStatus = 200,
  ) {
    super(message);
  }
}

const CAPABILITIES = { tools: { listChanged: false } };

/** Handle one JSON-RPC request object. Returns the `result` payload. */
export async function dispatch(
  msg: RpcRequest,
  ctx: { env: McpEnv; siteUrl: string; headerVersion: string | null },
): Promise<unknown> {
  const params = (msg.params ?? {}) as Record<string, unknown>;
  const meta = (params._meta ?? {}) as Record<string, unknown>;
  const metaVersion = typeof meta[META_VERSION] === "string" ? (meta[META_VERSION] as string) : null;

  // Legacy handshake. Stateless: we answer it, but nothing is remembered.
  if (msg.method === "initialize") {
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const version = (LEGACY_VERSIONS as readonly string[]).includes(requested) ? requested : LEGACY_VERSIONS[0];
    return { protocolVersion: version, capabilities: CAPABILITIES, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
  }

  const modern = metaVersion !== null || msg.method === "server/discover";
  if (modern) {
    const version = metaVersion ?? ctx.headerVersion ?? MODERN_VERSIONS[0];
    if (ctx.headerVersion && metaVersion && ctx.headerVersion !== metaVersion) {
      throw new RpcError(INVALID_REQUEST, "MCP-Protocol-Version header does not match _meta protocolVersion.", undefined, 400);
    }
    if (!(MODERN_VERSIONS as readonly string[]).includes(version)) {
      throw new RpcError(UNSUPPORTED_VERSION, "Unsupported protocol version", { supported: SUPPORTED_VERSIONS, requested: version });
    }
    if (msg.method !== "server/discover" && (typeof meta[META_CAPS] !== "object" || meta[META_CAPS] === null)) {
      throw new RpcError(INVALID_PARAMS, `Missing _meta["${META_CAPS}"].`);
    }
  } else if (ctx.headerVersion && !SUPPORTED_VERSIONS.includes(ctx.headerVersion)) {
    throw new RpcError(INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${ctx.headerVersion}`, { supported: SUPPORTED_VERSIONS }, 400);
  }

  const result = await dispatchMethod(msg.method ?? "", params, ctx);
  // Modern results are tagged complete (no multi-round-trip input requests here).
  return modern ? { resultType: "complete", ...(result as object) } : result;
}

async function dispatchMethod(
  method: string,
  params: Record<string, unknown>,
  ctx: { env: McpEnv; siteUrl: string },
): Promise<unknown> {
  switch (method) {
    case "server/discover":
      return {
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: CAPABILITIES,
        instructions: INSTRUCTIONS,
        _meta: { [META_SERVER_INFO]: SERVER_INFO },
        ttlMs: 3_600_000,
        cacheScope: "public",
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
      const result = await callTool(name, args, ctx.env, ctx.siteUrl);
      if (!result) throw new RpcError(INVALID_PARAMS, `Unknown tool: ${name}`);
      return result;
    }
    default:
      throw new RpcError(METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

// ── HTTP transport ───────────────────────────────────────────────────────────
function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

function rpcError(id: Id | null, code: number, message: string, data?: unknown, status = 200): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } }, status);
}

/**
 * Origins allowed to call us from a browser: our own, and localhost (MCP
 * Inspector and other dev tools). Server-side clients send no Origin at all.
 */
export function originAllowed(origin: string | null, requestUrl: string, siteUrl: string): boolean {
  if (!origin) return true;
  try {
    const o = new URL(origin);
    if (o.origin === new URL(requestUrl).origin || o.origin === new URL(siteUrl).origin) return true;
    return o.hostname === "localhost" || o.hostname === "127.0.0.1" || o.hostname === "[::1]";
  } catch {
    return false;
  }
}

export async function handleMcp(request: Request, env: McpEnv, siteUrl: string): Promise<Response> {
  if (!originAllowed(request.headers.get("origin"), request.url, siteUrl)) {
    return rpcError(null, INVALID_REQUEST, "Origin not allowed.", undefined, 403);
  }
  // No server-initiated SSE stream and no sessions to end.
  if (request.method === "GET" || request.method === "DELETE") {
    return new Response("Method Not Allowed. POST JSON-RPC messages to this endpoint.\n", {
      status: 405,
      headers: { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  let msg: unknown;
  try {
    msg = await request.json();
  } catch {
    return rpcError(null, PARSE_ERROR, "Parse error: body must be one JSON-RPC message.", undefined, 400);
  }
  // One message per POST; batches were removed from the protocol.
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || (msg as RpcRequest).jsonrpc !== "2.0") {
    return rpcError(null, INVALID_REQUEST, "Invalid Request: expected a single JSON-RPC 2.0 object.", undefined, 400);
  }
  const rpc = msg as RpcRequest;

  // Notifications and responses get 202 with no body.
  if (rpc.id === undefined || rpc.id === null || typeof rpc.method !== "string") {
    return new Response(null, { status: 202 });
  }

  try {
    const result = await dispatch(rpc, { env, siteUrl, headerVersion: request.headers.get("mcp-protocol-version") });
    return json({ jsonrpc: "2.0", id: rpc.id, result });
  } catch (err) {
    if (err instanceof RpcError) return rpcError(rpc.id, err.code, err.message, err.data, err.httpStatus);
    return rpcError(rpc.id, -32603, "Internal error");
  }
}

// ── Discovery metadata ───────────────────────────────────────────────────────
// MCP Server Card extension (SEP-2127, modelcontextprotocol/experimental-ext-server-card).
// The reserved location is `<streamable-http-url>/server-card`; domain-level
// discovery goes through the AI Catalog at /.well-known/ai-catalog.json.
export const SERVER_CARD_TYPE = "application/mcp-server-card+json";
export const AI_CATALOG_TYPE = "application/ai-catalog+json";
export const SERVER_CARD_PATH = `${MCP_ENDPOINT}/server-card`;

export function serverCard(siteUrl: string) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description: SERVER_INFO.description,
    title: SERVER_INFO.title,
    websiteUrl: `${siteUrl}/developers`,
    repository: { url: "https://github.com/KarthikSubramanian07/houseruled", source: "github" },
    icons: [{ src: `${siteUrl}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] }],
    remotes: [{ type: "streamable-http", url: `${siteUrl}${MCP_ENDPOINT}`, supportedProtocolVersions: [...SUPPORTED_VERSIONS] }],
  };
}

export function aiCatalog(siteUrl: string) {
  const host = new URL(siteUrl).host;
  return {
    specVersion: "1.0",
    entries: [{ identifier: `urn:air:${host}:mcp:houseruled`, type: SERVER_CARD_TYPE, url: `${siteUrl}${SERVER_CARD_PATH}` }],
  };
}
