import { beforeEach, describe, expect, it } from "vitest";
import { durableDatabase, type DurableDatabase } from "./durable-db";
import {
  authorizeWrite,
  bumpPlays,
  favoriteSlugs,
  getCustomGame,
  getProfile,
  listCustomGames,
  saveCustomGame,
  toggleFavorite,
  upsertProfile,
  type LibraryEnv,
} from "./library";
import { LibraryStore } from "../server/library-store";
import { LIBRARY_MIGRATIONS } from "../server/library-migrations";
import { sqliteStorage } from "../test/sqlite-storage";

// The real adapter over the real store over real SQLite - only the Durable
// Object RPC hop is replaced by a direct call (structured-cloned, as RPC does).
function setup() {
  const storage = sqliteStorage();
  const store = new LibraryStore(storage);
  store.migrate();
  const db = durableDatabase({
    query: async (statement) => structuredClone(store.query(structuredClone(statement))),
    batch: async (statements) => structuredClone(store.batch(structuredClone(statements))),
  });
  return { store, db, env: { DB: db } satisfies LibraryEnv };
}

describe("migrations", () => {
  it("creates the schema once and records each version", () => {
    const { store } = setup();
    expect(store.migrate()).toBe(LIBRARY_MIGRATIONS.length);
    expect(store.migrate()).toBe(LIBRARY_MIGRATIONS.length); // re-running is a no-op
    const versions = store.query({ sql: "select version, name from schema_migrations order by version" }).rows;
    expect(versions).toEqual(LIBRARY_MIGRATIONS.map((m) => [m.version, m.name]));
    const tables = store
      .query({ sql: "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name" })
      .rows.map((row) => row[0]);
    expect(tables).toEqual(["custom_games", "favorites", "player_auth", "schema_migrations", "users"]);
    const userColumns = store.query({ sql: "select name from pragma_table_info('users')" }).rows.map((row) => row[0]);
    expect(userColumns).toEqual(["id", "display_name", "created_at", "updated_at"]);
  });

  it("applies only newer migrations, and rolls a failing one back whole", () => {
    const { store } = setup();
    const next = LIBRARY_MIGRATIONS.length + 1;
    const broken = [
      ...LIBRARY_MIGRATIONS,
      { version: next, name: "broken", statements: ["create table extra (id integer primary key)", "this is not sql"] },
    ];
    expect(() => store.migrate(broken)).toThrow();
    expect(store.query({ sql: "select count(*) from sqlite_master where name = 'extra'" }).rows[0][0]).toBe(0);
    const fixed = [...LIBRARY_MIGRATIONS, { version: next, name: "extra", statements: ["create table extra (id integer primary key)"] }];
    expect(store.migrate(fixed)).toBe(next);
    expect(store.query({ sql: "select count(*) from sqlite_master where name = 'extra'" }).rows[0][0]).toBe(1);
  });
});

describe("durableDatabase", () => {
  let db: DurableDatabase;
  beforeEach(() => {
    db = setup().db;
  });

  it("run() reports changes and the last row id", async () => {
    const first = await db.prepare("insert into users (id, display_name) values (?, ?)").bind("u1", "Ada").run();
    expect(first.success).toBe(true);
    expect(first.meta.changes).toBe(1);
    expect(first.meta.last_row_id).toBe(1);
    expect(first.meta.changed_db).toBe(true);
    await db.prepare("insert into users (id, display_name) values (?, ?)").bind("u2", "Grace").run();
    const update = await db.prepare("update users set display_name = upper(display_name)").run();
    expect(update.meta.changes).toBe(2);
    const read = await db.prepare("select * from users").run();
    expect(read.meta.changes).toBe(0);
    expect(read.meta.changed_db).toBe(false);
  });

  it("first() returns a row, a single column, or null", async () => {
    await db.prepare("insert into users (id, display_name) values (?, ?)").bind("u1", "Ada").run();
    const statement = db.prepare("select id, display_name from users where id = ?");
    await expect(statement.bind("u1").first()).resolves.toEqual({ id: "u1", display_name: "Ada" });
    await expect(statement.bind("u1").first("display_name")).resolves.toBe("Ada");
    await expect(statement.bind("nobody").first()).resolves.toBeNull();
    await expect(statement.bind("u1").first("missing")).rejects.toThrow(/Column not found/);
  });

  it("all() returns keyed rows and raw() returns arrays", async () => {
    await db.prepare("insert into users (id, display_name) values (?, ?), (?, ?)").bind("u1", "Ada", "u2", null).run();
    const all = await db.prepare("select id, display_name from users order by id").all<{ id: string; display_name: string | null }>();
    expect(all.results).toEqual([
      { id: "u1", display_name: "Ada" },
      { id: "u2", display_name: null },
    ]);
    await expect(db.prepare("select id, display_name from users order by id").raw()).resolves.toEqual([
      ["u1", "Ada"],
      ["u2", null],
    ]);
  });

  it("bind() returns a new statement and leaves the original reusable", async () => {
    const insert = db.prepare("insert into users (id) values (?)");
    await insert.bind("a").run();
    await insert.bind("b").run();
    const { results } = await db.prepare("select id from users order by id").all();
    expect(results).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("binds booleans as 0/1 and rejects undefined", async () => {
    await db.prepare("insert into users (id) values (?)").bind("u1").run();
    await db
      .prepare("insert into custom_games (id, slug, title, is_public) values (?, ?, ?, ?)")
      .bind("g1", "s1", "T", false)
      .run();
    await expect(db.prepare("select is_public from custom_games").first("is_public")).resolves.toBe(0);
    await expect(db.prepare("insert into users (id) values (?)").bind(undefined).run()).rejects.toThrow(/undefined/);
  });

  it("surfaces SQL errors as rejections", async () => {
    await expect(db.prepare("select * from no_such_table").all()).rejects.toThrow();
    await db.prepare("insert into users (id) values (?)").bind("u1").run();
    await expect(db.prepare("insert into users (id) values (?)").bind("u1").run()).rejects.toThrow();
  });

  it("batch() runs statements in order and returns one result each", async () => {
    const results = await db.batch([
      db.prepare("insert into users (id, display_name) values (?, ?)").bind("u1", "Ada"),
      db.prepare("insert into favorites (user_id, slug) values (?, ?)").bind("u1", "game-1"),
      db.prepare("select count(*) as n from favorites where user_id = ?").bind("u1"),
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].meta.changes).toBe(1);
    expect(results[2].results).toEqual([{ n: 1 }]);
  });

  it("batch() is transactional: one failure rolls back every statement", async () => {
    await db.prepare("insert into users (id, display_name) values (?, ?)").bind("u1", "Ada").run();
    await expect(
      db.batch([
        db.prepare("insert into users (id, display_name) values (?, ?)").bind("u2", "Grace"),
        db.prepare("update users set display_name = ? where id = ?").bind("Changed", "u1"),
        db.prepare("insert into users (id, display_name) values (?, ?)").bind("u1", "Duplicate"), // primary key clash
        db.prepare("insert into users (id, display_name) values (?, ?)").bind("u3", "Never"),
      ]),
    ).rejects.toThrow();
    const { results } = await db.prepare("select id, display_name from users order by id").all();
    expect(results).toEqual([{ id: "u1", display_name: "Ada" }]);
    // The database is still usable afterwards.
    await db.batch([db.prepare("insert into users (id) values (?)").bind("u2")]);
    await expect(db.prepare("select count(*) as n from users").first("n")).resolves.toBe(2);
  });
});

describe("library queries on the durable store", () => {
  it("covers the save → list → favorite → profile → plays flow", async () => {
    const { env } = setup();
    await expect(authorizeWrite(env, "p1", "s3cret")).resolves.toEqual({ status: "ok" });
    await expect(authorizeWrite(env, "p1", "s3cret")).resolves.toEqual({ status: "ok" });
    await expect(authorizeWrite(env, "p1", "wrong")).resolves.toEqual({ status: "invalid_credentials" });

    const older = await saveCustomGame(env, { name: "Twos Wild", baseGame: "crazyeights", ruleTexts: ["Twos are wild"], explanation: "Wild twos.", creatorId: "p1", creatorName: "Ada" });
    const newer = await saveCustomGame(env, { name: "Speed War", baseGame: "war", ruleTexts: [], explanation: "Fast.", creatorId: "p1", creatorName: "Ada" });
    if (!older.ok || !newer.ok) throw new Error("save failed");

    await bumpPlays(env, older.slug);
    await bumpPlays(env, older.slug);
    expect((await listCustomGames(env)).map((g) => g.slug)).toEqual([older.slug, newer.slug]); // most played first
    expect((await listCustomGames(env, { sort: "new" })).map((g) => g.slug)).toEqual([newer.slug, older.slug]);
    expect((await listCustomGames(env, { search: "wild" })).map((g) => g.slug)).toEqual([older.slug]);
    expect((await listCustomGames(env, { base: "war" })).map((g) => g.slug)).toEqual([newer.slug]);

    const game = await getCustomGame(env, older.slug);
    expect(game).toMatchObject({ title: "Twos Wild", ruleTexts: ["Twos are wild"], plays: 2, creatorId: "p1", creatorName: "Ada" });
    await expect(getCustomGame(env, "nope")).resolves.toBeNull();

    await expect(toggleFavorite(env, "p2", older.slug)).resolves.toEqual({ favorited: true });
    await expect(favoriteSlugs(env, "p2")).resolves.toEqual([older.slug]);
    await upsertProfile(env, "p2", "Grace");
    const fan = await getProfile(env, "p2");
    expect(fan?.name).toBe("Grace");
    expect(fan?.favorites.map((g) => g.slug)).toEqual([older.slug]);
    await expect(toggleFavorite(env, "p2", older.slug)).resolves.toEqual({ favorited: false });
    await expect(favoriteSlugs(env, "p2")).resolves.toEqual([]);

    const creator = await getProfile(env, "p1");
    expect(creator?.createdGames.map((g) => g.slug)).toEqual([newer.slug, older.slug]);
    expect(creator?.totalPlays).toBe(2);
    await expect(getProfile(env, "ghost")).resolves.toBeNull();
  });
});

describe("import", () => {
  const snapshot = {
    users: [
      { rowid: 3, id: "u1", display_name: "Ada", created_at: "2026-07-07 11:59:39", updated_at: null },
      { rowid: 9, id: "u2", display_name: null, created_at: "2026-07-08 00:46:21", updated_at: "2026-07-11 11:13:01" },
    ],
    custom_games: [
      { rowid: 5, id: "g1", slug: "one-abcd", title: "One", description: "Line 1\nLine 2 'quoted'", base_game: "crazyeights", ruleset: '{"ruleTexts":["a"]}', creator_id: "u1", plays_count: 7, is_public: 1, created_at: "2026-07-07 12:00:00", updated_at: "2026-07-07 12:00:00" },
    ],
    favorites: [{ rowid: 2, user_id: "u2", slug: "one-abcd", created_at: "2026-07-07 11:59:58" }],
    player_auth: [{ rowid: 1, player_id: "u1", secret_hash: "abc", created_at: "2026-07-07 20:33:12" }],
  };

  it("loads a snapshot exactly, rowids included, and repeating it changes nothing", () => {
    const { store } = setup();
    expect(store.replaceAll(snapshot)).toEqual({ users: 2, custom_games: 1, favorites: 1, player_auth: 1 });
    expect(store.snapshot()).toEqual(snapshot);
    expect(store.replaceAll(snapshot)).toEqual({ users: 2, custom_games: 1, favorites: 1, player_auth: 1 });
    expect(store.snapshot()).toEqual(snapshot);
  });

  it("replaces rows left over from an earlier import", () => {
    const { store } = setup();
    store.replaceAll(snapshot);
    store.replaceAll({ ...snapshot, favorites: [] });
    expect(store.counts()).toEqual({ users: 2, custom_games: 1, favorites: 0, player_auth: 1 });
  });

  it("keeps the old contents when an import fails part-way", () => {
    const { store } = setup();
    store.replaceAll(snapshot);
    const bad = { ...snapshot, player_auth: [{ player_id: "u9", secret_hash: null }] }; // not-null violation, last table
    expect(() => store.replaceAll(bad)).toThrow();
    expect(store.snapshot()).toEqual(snapshot);
  });

  it("rejects unknown tables and unsafe column names", () => {
    const { store } = setup();
    expect(() => store.replaceAll({ schema_migrations: [] })).toThrow(/Unknown table/);
    expect(() => store.replaceAll({ users: [{ "id) values ('x'); --": 1 }] })).toThrow(/Bad column name/);
    expect(store.counts()).toEqual({ users: 0, custom_games: 0, favorites: 0, player_auth: 0 });
  });
});
