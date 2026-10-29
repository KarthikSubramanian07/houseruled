// Agent gateway: runs in worker.ts in front of the Next.js (OpenNext) handler.
//
//   - Machine-readable files (llms.txt, openapi.json, MCP discovery) and the
//     MCP endpoint are answered here directly.
//   - Page requests that prefer `text/markdown` get a Markdown representation
//     of the same URL (acceptmarkdown.com), or a Markdown 404 when the page
//     doesn't exist. Everything else falls through to Next untouched, plus
//     `Vary: Accept` so caches keep the two representations apart.

import { getCustomGame, listCustomGames, type LibraryEnv } from "../lib/library";
import {
  ABOUT,
  CONTACT,
  communityGameMarkdown,
  DEVELOPERS,
  docToMarkdown,
  homeDoc,
  INVENT_DOC,
  libraryMarkdown,
  llmsTxt,
  notFoundMarkdown,
  PRIVACY,
  type SiteDoc,
} from "./content";
import { aiCatalog, AI_CATALOG_TYPE, handleMcp, MCP_ENDPOINT, SERVER_CARD_PATH, SERVER_CARD_TYPE, serverCard } from "./mcp";
import { appendVaryAccept, MARKDOWN_CONTENT_TYPE, normalizePath, wantsMarkdown } from "./negotiate";
import { openApiSpec } from "./openapi";

export type GatewayEnv = LibraryEnv & { [key: string]: unknown };
type Next = (request: Request) => Promise<Response>;

const STATIC_DOCS: Record<string, () => SiteDoc> = {
  "/": homeDoc,
  "/about": () => ABOUT,
  "/contact": () => CONTACT,
  "/privacy": () => PRIVACY,
  "/developers": () => DEVELOPERS,
  "/invent": () => INVENT_DOC,
};

/** Explicit Markdown URL for a page: `/` → `/index.md`, `/about` → `/about.md`. */
export function markdownUrl(path: string): string {
  return path === "/" ? "/index.md" : `${path}.md`;
}

/** Inverse of markdownUrl, or null if `path` isn't a `.md` alias. */
function pageForMarkdownUrl(path: string): string | null {
  if (path === "/index.md") return "/";
  return path.endsWith(".md") ? path.slice(0, -3) : null;
}

/** Paths the gateway never touches: APIs (JSON), Next internals, and files. */
function isPassThrough(path: string): boolean {
  return path.startsWith("/api/") || path.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(path);
}

const PUBLIC_READ = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };

function file(body: string, contentType: string, method: string): Response {
  return new Response(method === "HEAD" ? null : body, { headers: { "Content-Type": contentType, ...PUBLIC_READ } });
}

function markdown(body: string, status: number, method: string, siteUrl: string, path: string): Response {
  const headers = new Headers({ "Content-Type": MARKDOWN_CONTENT_TYPE, ...PUBLIC_READ });
  if (status !== 200) headers.set("Cache-Control", "no-store");
  else headers.set("Link", `<${siteUrl}${path === "/" ? "/" : path}>; rel="canonical"`);
  appendVaryAccept(headers);
  return new Response(method === "HEAD" ? null : body, { status, headers });
}

/** Markdown for a page path, or null when there is no such page (→ 404). */
async function renderMarkdown(path: string, env: GatewayEnv, siteUrl: string): Promise<string | null | undefined> {
  const doc = STATIC_DOCS[path];
  if (doc) return docToMarkdown(doc(), siteUrl);
  if (path === "/games") return libraryMarkdown(await listCustomGames(env, { sort: "plays", limit: 50 }).catch(() => []), siteUrl);
  const game = path.match(/^\/game\/([^/]+)$/);
  if (game) {
    const g = await getCustomGame(env, decodeURIComponent(game[1])).catch(() => null);
    return g ? communityGameMarkdown(g, siteUrl) : null;
  }
  return undefined; // a page we have no Markdown for: let Next decide.
}

export async function handleAgentRequest(request: Request, env: GatewayEnv, next: Next, siteUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  const method = request.method;

  // ── MCP (all methods; the transport handles its own method rules) ────────
  if (path === MCP_ENDPOINT) return handleMcp(request, env, siteUrl);

  const readable = method === "GET" || method === "HEAD";
  if (readable) {
    switch (path) {
      case "/llms.txt":
        return file(llmsTxt(siteUrl), "text/plain; charset=utf-8", method);
      case "/openapi.json":
        return file(JSON.stringify(openApiSpec(siteUrl), null, 2), "application/json; charset=utf-8", method);
      case SERVER_CARD_PATH:
        return file(JSON.stringify(serverCard(siteUrl), null, 2), SERVER_CARD_TYPE, method);
      // Compatibility aliases some scanners probe; the card's home is /mcp/server-card.
      case "/.well-known/mcp":
      case "/.well-known/mcp.json":
      case "/.well-known/mcp/server-card.json":
        return file(JSON.stringify(serverCard(siteUrl), null, 2), "application/json; charset=utf-8", method);
      case "/.well-known/ai-catalog.json":
        return file(JSON.stringify(aiCatalog(siteUrl), null, 2), AI_CATALOG_TYPE, method);
    }

    // Explicit Markdown URLs (/index.md, /about.md, /games.md, ...).
    const mdPage = pageForMarkdownUrl(path);
    if (mdPage) {
      const md = await renderMarkdown(mdPage, env, siteUrl);
      if (typeof md === "string") return markdown(md, 200, method, siteUrl, mdPage);
      return markdown(notFoundMarkdown(path, siteUrl), 404, method, siteUrl, path);
    }
  }

  // Next's client router fetches RSC payloads from page URLs; never touch those.
  if (!readable || isPassThrough(path) || request.headers.has("rsc")) return next(request);

  if (wantsMarkdown(request.headers.get("accept"))) {
    const md = await renderMarkdown(path, env, siteUrl);
    if (typeof md === "string") return markdown(md, 200, method, siteUrl, path);
    if (md === null) return markdown(notFoundMarkdown(path, siteUrl), 404, method, siteUrl, path);
    // No Markdown twin: ask Next. A 404 still becomes a Markdown 404.
    const res = await next(request);
    if (res.status === 404) return markdown(notFoundMarkdown(path, siteUrl), 404, method, siteUrl, path);
    return withVary(res, path);
  }

  return withVary(await next(request), path);
}

/** HTML from Next, with `Vary: Accept` and a pointer to the Markdown twin. */
function withVary(res: Response, path: string): Response {
  // Re-wrapping a WebSocket upgrade would drop the socket.
  if (res.status === 101 || (res as { webSocket?: unknown }).webSocket) return res;
  const out = new Response(res.body, res);
  appendVaryAccept(out.headers);
  if (res.status === 200 && (STATIC_DOCS[path] || path === "/games")) {
    const links = [`<${markdownUrl(path)}>; rel="alternate"; type="text/markdown"`, `</llms.txt>; rel="describedby"; type="text/plain"`];
    const existing = out.headers.get("link");
    out.headers.set("Link", existing ? `${existing}, ${links.join(", ")}` : links.join(", "));
  }
  return out;
}
