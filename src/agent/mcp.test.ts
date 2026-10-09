import { describe, expect, it } from "vitest";
import {
  aiCatalog,
  handleMcp,
  LEGACY_VERSIONS,
  originAllowed,
  SERVER_INFO,
  serverCard,
  SUPPORTED_VERSIONS,
  TOOLS,
  type McpEnv,
} from "./mcp";
import type { D1DB, D1PreparedStatement } from "../lib/library";

const SITE = "https://playhouseruled.pages.dev";
const URL_ = `${SITE}/mcp`;

const ROW = {
  slug: "chaos",
  title: "Chaos Eights",
  description: "Everything is wild.",
  base_game: "crazyeights",
  ruleset: JSON.stringify({ ruleTexts: ["Sevens reverse"] }),
  plays_count: 4,
  creator_id: "p1",
  creator_name: "Ana",
};

/** Minimal D1 fake: every query returns ROW (or nothing for an unknown slug). */
function fakeDb(): D1DB {
  return {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt: D1PreparedStatement = {
        bind: (...v: unknown[]) => ((binds = v), stmt),
        run: async () => ({}),
        first: async <T,>() => (binds[0] === "chaos" ? (ROW as T) : null),
        all: async <T,>() => ({ results: (sql.includes("custom_games") ? [ROW] : []) as T[] }),
      };
      return stmt;
    },
  };
}

const ENV: McpEnv = { DB: fakeDb() };

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return handleMcp(
    new Request(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ENV,
    SITE,
  );
}

async function rpc(method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const res = await post({ jsonrpc: "2.0", id: 1, method, params }, headers);
  return { status: res.status, body: (await res.json()) as { result?: Record<string, unknown>; error?: { code: number; message: string; data?: unknown } } };
}

const modernMeta = (extra: Record<string, unknown> = {}) => ({
  _meta: {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    ...extra,
  },
});

describe("legacy handshake (initialize)", () => {
  it("echoes a supported legacy version with server info and tool capability", async () => {
    const { status, body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(status).toBe(200);
    expect(body.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
    });
    expect(typeof body.result?.instructions).toBe("string");
  });

  it("counters an unknown version with the newest legacy one", async () => {
    const { body } = await rpc("initialize", { protocolVersion: "1999-01-01", capabilities: {} });
    expect(body.result?.protocolVersion).toBe(LEGACY_VERSIONS[0]);
  });

  it("never issues a session id (stateless)", async () => {
    const res = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } });
    expect(res.headers.get("mcp-session-id")).toBeNull();
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("acks the initialized notification with 202 and no body", async () => {
    const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("lists and calls tools without _meta", async () => {
    const list = await rpc("tools/list", {}, { "MCP-Protocol-Version": "2025-06-18" });
    expect((list.body.result?.tools as { name: string }[]).map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(list.body.result).not.toHaveProperty("resultType");
  });

  it("rejects an unsupported MCP-Protocol-Version header with 400", async () => {
    const { status, body } = await rpc("tools/list", {}, { "MCP-Protocol-Version": "1999-01-01" });
    expect(status).toBe(400);
    expect(body.error?.code).toBe(-32600);
  });

  it("answers ping", async () => {
    expect((await rpc("ping")).body.result).toEqual({});
  });
});

describe("modern protocol (2026-07-28)", () => {
  it("server/discover advertises versions, capabilities, and server info", async () => {
    const { body } = await rpc("server/discover", modernMeta(), { "MCP-Protocol-Version": "2026-07-28" });
    expect(body.result).toMatchObject({
      resultType: "complete",
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: { tools: { listChanged: false } },
      _meta: { "io.modelcontextprotocol/serverInfo": { name: SERVER_INFO.name } },
    });
  });

  it("tags results complete", async () => {
    const { body } = await rpc("tools/list", modernMeta(), { "MCP-Protocol-Version": "2026-07-28" });
    expect(body.result?.resultType).toBe("complete");
    expect(body.result?.tools).toHaveLength(TOOLS.length);
  });

  it("returns UnsupportedProtocolVersionError for unknown modern versions", async () => {
    const { body } = await rpc("tools/list", modernMeta({ "io.modelcontextprotocol/protocolVersion": "2099-01-01" }));
    expect(body.error).toMatchObject({ code: -32022, data: { requested: "2099-01-01", supported: SUPPORTED_VERSIONS } });
  });

  it("400s when the header and _meta disagree", async () => {
    const { status } = await rpc("tools/list", modernMeta(), { "MCP-Protocol-Version": "2025-06-18" });
    expect(status).toBe(400);
  });

  it("rejects requests missing client capabilities with -32602", async () => {
    const { body } = await rpc("tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } });
    expect(body.error?.code).toBe(-32602);
  });
});

describe("tools", () => {
  async function call(name: string, args: Record<string, unknown> = {}) {
    const { body } = await rpc("tools/call", { name, arguments: args });
    return body.result as { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
  }

  it("declares read-only annotations and object input schemas", () => {
    for (const t of TOOLS) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.annotations.readOnlyHint).toBe(true);
    }
  });

  it("list_games returns the whole catalog", async () => {
    const r = await call("list_games");
    const games = r.structuredContent?.games as { id: string; freeTextHouseRules: boolean }[];
    expect(games).toHaveLength(16);
    expect(games.find((g) => g.id === "crazyeights")?.freeTextHouseRules).toBe(true);
    expect(r.content[0].type).toBe("text");
  });

  it("get_game_rules returns the guide and house-rule variants", async () => {
    const r = await call("get_game_rules", { game: "crazyeights" });
    expect(r.structuredContent).toMatchObject({ name: "Crazy Eights", goal: expect.any(String) });
    const rules = r.structuredContent?.houseRules as { id: string; exclusiveGroup?: string; requires?: string[] }[];
    expect(rules.find((x) => x.id === "ce8-stack-twos")?.requires).toEqual(["ce8-twos-draw-two"]);
  });

  it("reports an unknown game as a tool error, not a protocol error", async () => {
    const r = await call("get_game_rules", { game: "poker" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Unknown game/);
  });

  it("search_community_games reads the library and links to play", async () => {
    const r = await call("search_community_games", { query: "chaos", limit: 5 });
    expect(r.structuredContent?.games).toEqual([
      expect.objectContaining({ slug: "chaos", title: "Chaos Eights", playUrl: `${SITE}/game/chaos`, creator: "Ana" }),
    ]);
  });

  it("get_community_game returns rules, and a tool error when missing", async () => {
    const hit = await call("get_community_game", { slug: "chaos" });
    expect(hit.structuredContent).toMatchObject({ houseRules: ["Sevens reverse"], plays: 4 });
    expect((await call("get_community_game", { slug: "nope" })).isError).toBe(true);
  });

  it("reports a library outage as a tool error", async () => {
    const broken: McpEnv = { DB: { prepare: () => { throw new Error("no such table"); } } };
    const res = await handleMcp(
      new Request(URL_, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_community_games", arguments: {} } }),
      }),
      broken,
      SITE,
    );
    const body = (await res.json()) as { result: { isError: boolean; content: { text: string }[] } };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/temporarily unavailable/);
  });

  it("an unknown tool is a -32602 protocol error", async () => {
    const { body } = await rpc("tools/call", { name: "deal_cards", arguments: {} });
    expect(body.error?.code).toBe(-32602);
  });
});

describe("HTTP transport", () => {
  it("405s GET and DELETE (no SSE stream, no sessions)", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await handleMcp(new Request(URL_, { method }), ENV, SITE);
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
  });

  it("rejects bad JSON, batches, and non-2.0 messages", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post([{ jsonrpc: "2.0", id: 1, method: "ping" }])).status).toBe(400);
    expect((await post({ id: 1, method: "ping" })).status).toBe(400);
  });

  it("unknown methods are -32601", async () => {
    expect((await rpc("resources/list")).body.error?.code).toBe(-32601);
  });

  it("403s foreign browser origins (DNS-rebinding guard)", async () => {
    const res = await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("allows no origin, our own, and localhost tools", () => {
    expect(originAllowed(null, URL_, SITE)).toBe(true);
    expect(originAllowed(SITE, URL_, SITE)).toBe(true);
    expect(originAllowed("http://localhost:6274", URL_, SITE)).toBe(true);
    expect(originAllowed("not a url", URL_, SITE)).toBe(false);
  });
});

describe("discovery documents", () => {
  it("server card matches the v1 Server Card schema rules", () => {
    const card = serverCard(SITE);
    expect(card.$schema).toBe("https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
    expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(card.description.length).toBeLessThanOrEqual(100);
    expect(card.title.length).toBeLessThanOrEqual(100);
    expect(card.remotes).toEqual([{ type: "streamable-http", url: `${SITE}/mcp`, supportedProtocolVersions: SUPPORTED_VERSIONS }]);
    // Server Cards don't enumerate primitives.
    expect(card).not.toHaveProperty("tools");
  });

  it("server card agrees with runtime serverInfo", () => {
    expect(serverCard(SITE).name).toBe(SERVER_INFO.name);
    expect(serverCard(SITE).version).toBe(SERVER_INFO.version);
  });

  it("AI catalog points at the server card", () => {
    expect(aiCatalog(SITE)).toEqual({
      specVersion: "1.0",
      entries: [
        { identifier: "urn:air:playhouseruled.pages.dev:mcp:houseruled", type: "application/mcp-server-card+json", url: `${SITE}/mcp/server-card` },
      ],
    });
  });
});
