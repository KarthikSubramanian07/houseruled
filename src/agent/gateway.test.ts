import { describe, expect, it, vi } from "vitest";
import { handleAgentRequest, markdownUrl, type GatewayEnv } from "./gateway";

const SITE = "https://playhouseruled.pages.dev";

/** Stand-in for the OpenNext handler: HTML for known pages, 404 otherwise. */
function nextStub() {
  return vi.fn(async (req: Request) => {
    const path = new URL(req.url).pathname;
    const known = ["/", "/about", "/games", "/room/ABCDEF", "/u/p1"].includes(path) || path.startsWith("/api/");
    return new Response(known ? "<!doctype html><h1>page</h1>" : "<!doctype html><h1>404</h1>", {
      status: known ? 200 : 404,
      headers: { "Content-Type": "text/html; charset=utf-8", Vary: "rsc, next-router-state-tree" },
    });
  });
}

async function get(path: string, headers: Record<string, string> = {}, method = "GET", env: GatewayEnv = {}) {
  const next = nextStub();
  const res = await handleAgentRequest(new Request(`${SITE}${path}`, { method, headers }), env, next, SITE);
  return { res, next, text: method === "HEAD" ? "" : await res.text() };
}

describe("Markdown negotiation on the homepage", () => {
  it("serves Markdown with Vary: Accept to Accept: text/markdown", async () => {
    const { res, text, next } = await get("/", { Accept: "text/markdown" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toMatch(/\bAccept\b/);
    expect(text).toMatch(/^# Houseruled: /);
    expect(text.length).toBeGreaterThan(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps serving Next's HTML to browsers, adding Accept to Vary and a Markdown alternate", async () => {
    const { res, text } = await get("/", { Accept: "text/html" });
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(text).toContain("<h1>page</h1>");
    expect(res.headers.get("vary")).toBe("rsc, next-router-state-tree, Accept");
    expect(res.headers.get("link")).toContain('</index.md>; rel="alternate"; type="text/markdown"');
  });

  it("treats */* and no Accept as HTML", async () => {
    expect((await get("/", { Accept: "*/*" })).res.headers.get("content-type")).toMatch(/^text\/html/);
    expect((await get("/")).res.headers.get("content-type")).toMatch(/^text\/html/);
  });

  it("answers HEAD with headers only", async () => {
    const { res } = await get("/", { Accept: "text/markdown" }, "HEAD");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.body).toBeNull();
  });
});

describe("Markdown for every public page", () => {
  it.each(["/about", "/contact", "/privacy", "/developers", "/invent", "/games"])("%s", async (path) => {
    const { res, text } = await get(path, { Accept: "text/markdown" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(text).toMatch(/^# /);
    expect(res.headers.get("link")).toBe(`<${SITE}${path}>; rel="canonical"`);
  });

  it("serves explicit .md URLs", async () => {
    const { res, text } = await get("/index.md");
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(text).toMatch(/^# Houseruled/);
    expect((await get("/about.md")).text).toMatch(/^# About Houseruled/);
    expect(markdownUrl("/")).toBe("/index.md");
    expect(markdownUrl("/about")).toBe("/about.md");
  });

  it("falls back to HTML for pages with no Markdown twin", async () => {
    const { res, next } = await get("/u/p1", { Accept: "text/markdown" });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(res.headers.get("vary")).toMatch(/Accept/);
  });
});

describe("agent-friendly 404s", () => {
  it("returns a Markdown 404 body for unknown paths when Markdown is wanted", async () => {
    const { res, text } = await get("/__ora-404-probe-x", { Accept: "text/markdown" });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toMatch(/Accept/);
    expect(text).toContain(`${SITE}/llms.txt`);
    expect(text.length).toBeGreaterThan(20);
  });

  it("404s a missing community game in Markdown without asking Next", async () => {
    const { res, next } = await get("/game/missing", { Accept: "text/markdown" });
    expect(res.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("404s unknown .md URLs in Markdown", async () => {
    expect((await get("/nope.md")).res.status).toBe(404);
  });

  it("keeps the HTML 404 for browsers", async () => {
    const { res, text } = await get("/nope", { Accept: "text/html" });
    expect(res.status).toBe(404);
    expect(text).toContain("<h1>404</h1>");
  });
});

describe("machine-readable files", () => {
  it.each([
    ["/llms.txt", "text/plain; charset=utf-8"],
    ["/openapi.json", "application/json; charset=utf-8"],
    ["/mcp/server-card", "application/mcp-server-card+json"],
    ["/.well-known/mcp", "application/json; charset=utf-8"],
    ["/.well-known/mcp.json", "application/json; charset=utf-8"],
    ["/.well-known/mcp/server-card.json", "application/json; charset=utf-8"],
    ["/.well-known/ai-catalog.json", "application/ai-catalog+json"],
  ])("%s is %s with CORS", async (path, type) => {
    const { res, text, next } = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(type);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(text.length).toBeGreaterThan(50);
    expect(next).not.toHaveBeenCalled();
  });

  it("parses openapi.json as OpenAPI 3.1", async () => {
    const spec = JSON.parse((await get("/openapi.json")).text);
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toEqual(["/api/games", "/api/games/{slug}"]);
  });

  it("routes /mcp to the MCP server", async () => {
    const next = nextStub();
    const res = await handleAgentRequest(
      new Request(`${SITE}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" }),
      }),
      {},
      next,
      SITE,
    );
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 7, result: {} });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("pass-through", () => {
  it("never negotiates APIs, RSC fetches, or non-GET requests", async () => {
    for (const [path, headers, method] of [
      ["/api/games", { Accept: "text/markdown" }, "GET"],
      ["/", { Accept: "text/markdown", RSC: "1" }, "GET"],
      ["/about", { Accept: "text/markdown" }, "POST"],
    ] as const) {
      const { next, res } = await get(path, headers, method);
      expect(next).toHaveBeenCalledOnce();
      expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    }
  });

  it("returns WebSocket-style 101 responses untouched", async () => {
    const upgrade = { status: 101, headers: new Headers(), webSocket: {} } as unknown as Response;
    const res = await handleAgentRequest(new Request(`${SITE}/u/p1`), {}, async () => upgrade, SITE);
    expect(res).toBe(upgrade);
  });
});
