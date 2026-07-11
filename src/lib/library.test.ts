import { describe, it, expect } from "vitest";
import { authorizeWrite, type D1DB, type LibraryEnv } from "./library";
import { clientIp } from "./ratelimit";

function mockDb(opts: {
  existingHash?: string | null;
  insertRaceHash?: string;
}): D1DB {
  const store = new Map<string, string>();
  if (opts.existingHash) store.set("player-1", opts.existingHash);

  return {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          binds.push(...values);
          return stmt;
        },
        async first<T>() {
          if (sql.includes("select secret_hash")) {
            const id = String(binds[0]);
            const hash = store.get(id);
            return (hash ? { secret_hash: hash } : null) as T;
          }
          return null as T;
        },
        async run() {
          if (sql.includes("insert into player_auth")) {
            const id = String(binds[0]);
            const hash = String(binds[1]);
            if (!store.has(id)) store.set(id, opts.insertRaceHash ?? hash);
          }
          return {};
        },
        async all() {
          return { results: [] };
        },
      };
      return stmt;
    },
  };
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("authorizeWrite", () => {
  it("allows writes when DB is not configured", async () => {
    await expect(authorizeWrite({}, "any", "")).resolves.toBe(true);
  });

  it("rejects empty id", async () => {
    const env: LibraryEnv = { DB: mockDb({}) };
    await expect(authorizeWrite(env, "", "secret")).resolves.toBe(false);
  });

  it("rejects unclaimed id without a secret", async () => {
    const env: LibraryEnv = { DB: mockDb({}) };
    await expect(authorizeWrite(env, "player-1", "")).resolves.toBe(false);
  });

  it("binds secret on first claim", async () => {
    const env: LibraryEnv = { DB: mockDb({}) };
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toBe(true);
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toBe(true);
    await expect(authorizeWrite(env, "player-1", "wrong")).resolves.toBe(false);
  });

  it("rejects wrong secret for a claimed id", async () => {
    const hash = await sha256hex("right");
    const env: LibraryEnv = { DB: mockDb({ existingHash: hash }) };
    await expect(authorizeWrite(env, "player-1", "wrong")).resolves.toBe(false);
    await expect(authorizeWrite(env, "player-1", "right")).resolves.toBe(true);
  });

  it("fails open when the DB throws", async () => {
    const env: LibraryEnv = {
      DB: {
        prepare() {
          throw new Error("no such table");
        },
      },
    };
    await expect(authorizeWrite(env, "player-1", "s3cret")).resolves.toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers CF-Connecting-IP", () => {
    const req = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "1.2.3.4",
        "X-Forwarded-For": "9.9.9.9, 8.8.8.8",
      },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("takes the first X-Forwarded-For hop", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": " 9.9.9.9 , 8.8.8.8" },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });
});
