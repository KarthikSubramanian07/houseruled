// Community library + public profiles + favorites (Phase 5), all in D1. Server
// only. Identity is the player's id (anonymous localStorage id today, Google-auth
// id later - same column). Profiles are public and queryable by id.
// Minimal D1 shapes so this compiles without @cloudflare/workers-types.

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1DB {
  prepare(sql: string): D1PreparedStatement;
}
export interface LibraryEnv {
  DB?: D1DB;
}

export interface CustomGame {
  slug: string;
  title: string;
  baseGame: string;
  ruleTexts: string[];
  explanation: string;
  plays: number;
  creatorId: string | null;
  creatorName: string | null;
}

interface Row {
  slug: string;
  title: string;
  base_game: string;
  ruleset: string;
  description: string | null;
  plays_count: number;
  creator_id: string | null;
  creator_name: string | null;
}

function rowToGame(r: Row): CustomGame {
  let ruleTexts: string[] = [];
  try {
    ruleTexts = (JSON.parse(r.ruleset) as { ruleTexts?: string[] }).ruleTexts ?? [];
  } catch {
    /* corrupt ruleset → no rules */
  }
  return {
    slug: r.slug,
    title: r.title,
    baseGame: r.base_game,
    ruleTexts,
    explanation: r.description ?? "",
    plays: r.plays_count,
    creatorId: r.creator_id,
    creatorName: r.creator_name,
  };
}

const SELECT =
  "select g.slug, g.title, g.base_game, g.ruleset, g.description, g.plays_count, g.creator_id, u.display_name as creator_name from custom_games g left join users u on u.id = g.creator_id";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "game";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ── Write authentication (per-player secret, trust-on-first-use) ───────────────
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type AuthorizeResult =
  | { status: "ok" }
  | { status: "invalid_credentials" }
  | { status: "auth_unavailable" };

/**
 * Prove the caller owns `id` before a write. First write for an id binds its
 * secret hash (TOFU); later writes must match. Unclaimed ids require a non-empty
 * secret so a stranger cannot write as an id they do not hold. Fails closed on
 * DB errors so a compromised or unavailable store never authorizes writes.
 */
export async function authorizeWrite(env: LibraryEnv, id: string, secret: string): Promise<AuthorizeResult> {
  if (!env.DB) return { status: "ok" }; // library not configured (e.g. next dev)
  if (!id || !secret) return { status: "invalid_credentials" };
  try {
    const row = await env.DB.prepare("select secret_hash from player_auth where player_id = ?").bind(id).first<{ secret_hash: string }>();
    if (!row) {
      const hash = await sha256hex(secret);
      await env.DB.prepare("insert into player_auth (player_id, secret_hash) values (?, ?) on conflict(player_id) do nothing").bind(id, hash).run();
      const check = await env.DB.prepare("select secret_hash from player_auth where player_id = ?").bind(id).first<{ secret_hash: string }>();
      return !check || check.secret_hash === hash ? { status: "ok" } : { status: "invalid_credentials" };
    }
    return row.secret_hash === (await sha256hex(secret)) ? { status: "ok" } : { status: "invalid_credentials" };
  } catch {
    return { status: "auth_unavailable" };
  }
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  name: string | null;
  createdAt: string | null;
  createdGames: CustomGame[];
  favorites: CustomGame[];
  /** Total plays across everything this player has created. */
  totalPlays: number;
}

export async function upsertProfile(env: LibraryEnv, id: string, name: string): Promise<void> {
  if (!env.DB || !id) return;
  try {
    await env.DB.prepare(
      "insert into users (id, display_name, updated_at) values (?, ?, datetime('now')) on conflict(id) do update set display_name = excluded.display_name, updated_at = datetime('now')",
    )
      .bind(id, name.slice(0, 24))
      .run();
  } catch {
    /* non-fatal */
  }
}

export async function getProfile(env: LibraryEnv, id: string): Promise<Profile | null> {
  if (!env.DB || !id) return null;
  const user = await env.DB.prepare("select display_name, created_at from users where id = ?").bind(id).first<{ display_name: string | null; created_at: string | null }>();
  const created = await env.DB.prepare(`${SELECT} where g.is_public = 1 and g.creator_id = ? order by g.rowid desc limit 100`).bind(id).all<Row>();
  const favs = await env.DB
    .prepare(`${SELECT} join favorites f on f.slug = g.slug where g.is_public = 1 and f.user_id = ? order by f.created_at desc limit 100`)
    .bind(id)
    .all<Row>();
  // A profile exists if the user has a name or any created games.
  if (!user && created.results.length === 0 && favs.results.length === 0) return null;
  const createdGames = created.results.map(rowToGame);
  return {
    id,
    name: user?.display_name ?? null,
    createdAt: user?.created_at ?? null,
    createdGames,
    favorites: favs.results.map(rowToGame),
    totalPlays: createdGames.reduce((n, g) => n + g.plays, 0),
  };
}

// ── Favorites ─────────────────────────────────────────────────────────────────
export async function toggleFavorite(env: LibraryEnv, userId: string, slug: string): Promise<{ favorited: boolean }> {
  if (!env.DB || !userId || !slug) return { favorited: false };
  const existing = await env.DB.prepare("select 1 as x from favorites where user_id = ? and slug = ?").bind(userId, slug).first();
  if (existing) {
    await env.DB.prepare("delete from favorites where user_id = ? and slug = ?").bind(userId, slug).run();
    return { favorited: false };
  }
  await env.DB.prepare("insert into favorites (user_id, slug) values (?, ?)").bind(userId, slug).run();
  return { favorited: true };
}

export async function favoriteSlugs(env: LibraryEnv, userId: string): Promise<string[]> {
  if (!env.DB || !userId) return [];
  const { results } = await env.DB.prepare("select slug from favorites where user_id = ?").bind(userId).all<{ slug: string }>();
  return results.map((r) => r.slug);
}

// ── Games ─────────────────────────────────────────────────────────────────────
export async function saveCustomGame(
  env: LibraryEnv,
  game: { name: string; baseGame: string; ruleTexts: string[]; explanation: string; creatorId?: string; creatorName?: string },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  if (!env.DB) return { ok: false, error: "Library isn't configured." };
  const slug = slugify(game.name);
  const id = crypto.randomUUID();
  const ruleset = JSON.stringify({ ruleTexts: game.ruleTexts.slice(0, 8) });
  try {
    if (game.creatorId && game.creatorName) await upsertProfile(env, game.creatorId, game.creatorName);
    await env.DB.prepare(
      "insert into custom_games (id, slug, title, description, base_game, ruleset, creator_id, is_public) values (?, ?, ?, ?, ?, ?, ?, 1)",
    )
      .bind(id, slug, game.name.slice(0, 40), game.explanation.slice(0, 300), game.baseGame, ruleset, game.creatorId ?? null)
      .run();
    return { ok: true, slug };
  } catch {
    return { ok: false, error: "Couldn't save that game." };
  }
}

export async function getCustomGame(env: LibraryEnv, slug: string): Promise<CustomGame | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare(`${SELECT} where g.slug = ? and g.is_public = 1`).bind(slug).first<Row>();
  return row ? rowToGame(row) : null;
}

export interface LibraryQuery {
  search?: string;
  base?: string;
  sort?: "plays" | "new";
  limit?: number;
}

export async function listCustomGames(env: LibraryEnv, q: LibraryQuery = {}): Promise<CustomGame[]> {
  if (!env.DB) return [];
  const conds = ["g.is_public = 1"];
  const binds: unknown[] = [];
  if (q.base) {
    conds.push("g.base_game = ?");
    binds.push(q.base);
  }
  if (q.search && q.search.trim()) {
    conds.push("(lower(g.title) like ? or lower(g.description) like ?)");
    const like = `%${q.search.trim().toLowerCase().slice(0, 60)}%`;
    binds.push(like, like);
  }
  const order = q.sort === "new" ? "g.rowid desc" : "g.plays_count desc, g.rowid desc";
  const limit = Math.min(100, q.limit ?? 50);
  const sql = `${SELECT} where ${conds.join(" and ")} order by ${order} limit ?`;
  binds.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...binds).all<Row>();
  return results.map(rowToGame);
}

export async function bumpPlays(env: LibraryEnv, slug: string): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare("update custom_games set plays_count = plays_count + 1 where slug = ?").bind(slug).run();
  } catch {
    /* non-fatal */
  }
}
