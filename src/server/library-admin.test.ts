import { describe, expect, it } from "vitest";
import { handleLibraryAdmin, LIBRARY_ADMIN_PATH } from "./library-admin";
import type { LibraryBindings } from "./library-binding";

const URL = `https://example.test${LIBRARY_ADMIN_PATH}`;
const SECRET = "correct-horse";

/** A LIBRARY_DO namespace whose one instance records what it was asked to do. */
function fakeEnv(secret?: string) {
  const calls: unknown[] = [];
  const counts = { users: 1, custom_games: 0, favorites: 0, player_auth: 0 };
  const stub = {
    counts: async () => counts,
    snapshot: async () => ({ users: [{ rowid: 1, id: "u1" }], custom_games: [], favorites: [], player_auth: [] }),
    replaceAll: async (tables: Record<string, unknown>) => {
      if ("nope" in tables) throw new Error("Unknown table: nope");
      calls.push(tables);
      return counts;
    },
  };
  const namespace = { idFromName: (name: string) => name, get: () => stub };
  const env = { LIBRARY_DO: namespace, LIBRARY_ADMIN_SECRET: secret } as unknown as LibraryBindings;
  return { env, calls };
}

function request(method: string, token?: string, body?: string): Request {
  return new Request(URL, { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body });
}

describe("library admin route", () => {
  it("does not exist while the secret is unset", async () => {
    const { env } = fakeEnv(undefined);
    expect((await handleLibraryAdmin(request("GET", SECRET), env)).status).toBe(404);
    expect((await handleLibraryAdmin(request("POST", SECRET, "{}"), env)).status).toBe(404);
  });

  it("does not exist without the Durable Object binding", async () => {
    const env = { LIBRARY_ADMIN_SECRET: SECRET } as unknown as LibraryBindings;
    expect((await handleLibraryAdmin(request("GET", SECRET), env)).status).toBe(404);
  });

  it("rejects a missing or wrong token", async () => {
    const { env, calls } = fakeEnv(SECRET);
    expect((await handleLibraryAdmin(request("GET"), env)).status).toBe(401);
    expect((await handleLibraryAdmin(request("GET", "wrong"), env)).status).toBe(401);
    expect((await handleLibraryAdmin(request("POST", "correct-hors", '{"tables":{}}'), env)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("returns a snapshot on GET", async () => {
    const { env } = fakeEnv(SECRET);
    const res = await handleLibraryAdmin(request("GET", SECRET), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { counts: Record<string, number>; tables: Record<string, unknown[]> };
    expect(body.counts.users).toBe(1);
    expect(body.tables.users).toEqual([{ rowid: 1, id: "u1" }]);
  });

  it("restores a snapshot on POST and reports bad input", async () => {
    const { env, calls } = fakeEnv(SECRET);
    const ok = await handleLibraryAdmin(request("POST", SECRET, JSON.stringify({ tables: { users: [] } })), env);
    expect(ok.status).toBe(200);
    expect(calls).toEqual([{ users: [] }]);
    expect((await handleLibraryAdmin(request("POST", SECRET, "not json"), env)).status).toBe(400);
    expect((await handleLibraryAdmin(request("POST", SECRET, "{}"), env)).status).toBe(400);
    const failed = await handleLibraryAdmin(request("POST", SECRET, JSON.stringify({ tables: { nope: [] } })), env);
    expect(failed.status).toBe(400);
    expect(await failed.json()).toMatchObject({ error: "restore_failed", message: "Unknown table: nope" });
    expect(calls).toHaveLength(1);
  });

  it("allows only GET and POST", async () => {
    const { env } = fakeEnv(SECRET);
    expect((await handleLibraryAdmin(request("DELETE", SECRET), env)).status).toBe(405);
  });
});
