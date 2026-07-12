import { describe, expect, it } from "vitest";
import { authorizeWrite, type D1DB, type D1PreparedStatement, type LibraryEnv } from "./library";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeEnv(db: D1DB): LibraryEnv {
  return { DB: db };
}

function boundStmt(
  secrets: Record<string, string>,
  fail: boolean,
  isSelect: boolean,
  isInsert: boolean,
  id: string,
  secretHash?: string,
): D1PreparedStatement {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    async first<T>(): Promise<T | null> {
      if (fail) throw new Error("D1 unavailable");
      if (!isSelect) return null;
      const stored = secrets[id];
      return stored ? ({ secret_hash: stored } as T) : null;
    },
    async run() {
      if (fail) throw new Error("D1 unavailable");
      if (isInsert && secretHash && !secrets[id]) secrets[id] = secretHash;
      return { success: true };
    },
    async all<T>(): Promise<{ results: T[] }> {
      if (fail) throw new Error("D1 unavailable");
      return { results: [] };
    },
  };
  return stmt;
}

function mockDb(secrets: Record<string, string>, fail = false): D1DB {
  return {
    prepare(sql: string) {
      const isSelect = sql.toLowerCase().includes("select");
      const isInsert = sql.toLowerCase().includes("insert");
      return {
        bind(...values: unknown[]) {
          const id = String(values[0] ?? "");
          const secretHash = typeof values[1] === "string" ? values[1] : undefined;
          return boundStmt(secrets, fail, isSelect, isInsert, id, secretHash);
        },
        async run() {
          if (fail) throw new Error("D1 unavailable");
          return { success: true };
        },
        async first<T>(): Promise<T | null> {
          return null;
        },
        async all<T>(): Promise<{ results: T[] }> {
          return { results: [] };
        },
      };
    },
  };
}

describe("authorizeWrite", () => {
  it("allows writes when no DB is configured (local dev)", async () => {
    await expect(authorizeWrite({}, "any", "secret")).resolves.toEqual({ status: "ok" });
  });

  it("rejects missing id or secret", async () => {
    const env = makeEnv(mockDb({}));
    await expect(authorizeWrite(env, "", "secret")).resolves.toEqual({ status: "invalid_credentials" });
    await expect(authorizeWrite(env, "player-1", "")).resolves.toEqual({ status: "invalid_credentials" });
  });

  it("registers the first secret for a new id", async () => {
    const secrets: Record<string, string> = {};
    const env = makeEnv(mockDb(secrets));
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toEqual({ status: "ok" });
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toEqual({ status: "ok" });
    await expect(authorizeWrite(env, "player-1", "wrong")).resolves.toEqual({ status: "invalid_credentials" });
    expect(secrets["player-1"]).toBe(await sha256hex("s3cret"));
  });

  it("rejects a wrong secret for an existing id", async () => {
    const secrets = { "player-1": await sha256hex("right") };
    const env = makeEnv(mockDb(secrets));
    await expect(authorizeWrite(env, "player-1", "wrong")).resolves.toEqual({ status: "invalid_credentials" });
    await expect(authorizeWrite(env, "player-1", "right")).resolves.toEqual({ status: "ok" });
  });

  it("fails closed when the DB throws", async () => {
    const env = makeEnv(mockDb({}, true));
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toEqual({ status: "auth_unavailable" });
  });
});
