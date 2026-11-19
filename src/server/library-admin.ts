/// <reference types="@cloudflare/workers-types" />

// One-time data move from D1 into the LibraryDO Durable Object.
//
//   GET  /api/admin/library  → { store, counts, tables }   (what the DO holds)
//   POST /api/admin/library  → replace the DO's contents with the posted
//                              { tables: { users: [...], ... } } snapshot
//
// Both need `Authorization: Bearer <LIBRARY_IMPORT_SECRET>`. With that Worker
// secret unset the path does not exist (404), so deleting the secret disables
// it. The import replaces everything in one transaction, so repeating it is
// safe - and it refuses to run once the Durable Object is serving the site,
// when a replace would wipe newer writes.

import { libraryStub, servedByDurableObject, type LibraryBindings } from "./library-binding";

export const LIBRARY_ADMIN_PATH = "/api/admin/library";

interface AdminEnv extends LibraryBindings {
  LIBRARY_IMPORT_SECRET?: string;
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
  const secret = env.LIBRARY_IMPORT_SECRET;
  const stub = libraryStub(env);
  if (!secret || !stub) return json({ error: "not_found" }, 404);

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!given || !(await sameSecret(given, secret))) return json({ error: "unauthorized" }, 401);

  const store = servedByDurableObject(env) ? "durable-object" : "d1";

  if (request.method === "GET") {
    return json({ store, counts: await stub.counts(), tables: await stub.snapshot() });
  }

  if (request.method === "POST") {
    if (store === "durable-object") return json({ error: "already_cut_over" }, 409);
    let body: { tables?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    if (!body.tables || typeof body.tables !== "object") return json({ error: "missing_tables" }, 400);
    try {
      const counts = await stub.replaceAll(body.tables as Record<string, Record<string, unknown>[]>);
      return json({ ok: true, store, counts });
    } catch (err) {
      return json({ error: "import_failed", message: err instanceof Error ? err.message : String(err) }, 400);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
}
