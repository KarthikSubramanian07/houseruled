// Community library (Phase 4/5) — saved custom games in D1. Server only.
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
}

interface Row {
  slug: string;
  title: string;
  base_game: string;
  ruleset: string;
  description: string | null;
  plays_count: number;
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
  };
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "game";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function saveCustomGame(
  env: LibraryEnv,
  game: { name: string; baseGame: string; ruleTexts: string[]; explanation: string; creatorId?: string },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  if (!env.DB) return { ok: false, error: "Library isn't configured." };
  const slug = slugify(game.name);
  const id = crypto.randomUUID();
  const ruleset = JSON.stringify({ ruleTexts: game.ruleTexts.slice(0, 8) });
  try {
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
  const row = await env.DB.prepare(
    "select slug, title, base_game, ruleset, description, plays_count from custom_games where slug = ? and is_public = 1",
  )
    .bind(slug)
    .first<Row>();
  return row ? rowToGame(row) : null;
}

export async function listCustomGames(env: LibraryEnv, limit = 50): Promise<CustomGame[]> {
  if (!env.DB) return [];
  const { results } = await env.DB.prepare(
    "select slug, title, base_game, ruleset, description, plays_count from custom_games where is_public = 1 order by plays_count desc, rowid desc limit ?",
  )
    .bind(limit)
    .all<Row>();
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
