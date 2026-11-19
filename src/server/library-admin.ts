/// <reference types="@cloudflare/workers-types" />

// Backup and restore for the library, which lives inside the LibraryDO Durable
// Object and so has no dashboard or CLI export of its own.
//
//   GET  /api/admin/library  → { counts, tables }   every row, rowids included
//   POST /api/admin/library  → replace the library with the posted
//                              { tables: { users: [...], ... } } snapshot
//
// Both need `Authorization: Bearer <LIBRARY_ADMIN_SECRET>`. That Worker secret
// is normally NOT set, and without it this path does not exist (404). To use it:
// `wrangler secret put LIBRARY_ADMIN_SECRET`, do the backup or restore, then
// `wrangler secret delete LIBRARY_ADMIN_SECRET`. A restore replaces everything
// in one transaction: it either fully applies or leaves the library untouched.

import { libraryStub, type LibraryBindings } from "./library-binding";

export const LIBRARY_ADMIN_PATH = "/api/admin/library";

interface AdminEnv extends LibraryBindings {
  LIBRARY_ADMIN_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** Compare via fixed-length digests so timing doesn't leak the secret. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function handleLibraryAdmin(request: Request, env: AdminEnv): Promise<Response> {
  const secret = env.LIBRARY_ADMIN_SECRET;
  const stub = libraryStub(env);
  if (!secret || !stub) return json({ error: "not_found" }, 404);

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!given || !(await sameSecret(given, secret))) return json({ error: "unauthorized" }, 401);

  if (request.method === "GET") {
    return json({ counts: await stub.counts(), tables: await stub.snapshot() });
  }

  if (request.method === "POST") {
    let body: { tables?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    if (!body.tables || typeof body.tables !== "object") return json({ error: "missing_tables" }, 400);
    try {
      const counts = await stub.replaceAll(body.tables as Record<string, Record<string, unknown>[]>);
      return json({ ok: true, counts });
    } catch (err) {
      return json({ error: "restore_failed", message: err instanceof Error ? err.message : String(err) }, 400);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
}
