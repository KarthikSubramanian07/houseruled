// Schema for the community library, applied inside the LibraryDO Durable Object.
//
// Migrations are append-only and versioned: each entry runs at most once, in
// order, inside one transaction, and the applied version is recorded in
// `schema_migrations`. To change the schema, add a new entry - never edit an
// applied one.
//
// Live rooms and game state do NOT live here - each room is its own Durable
// Object (see room-do.ts). This holds the durable, queryable library: saved
// custom games, public profiles, favorites, and per-player write auth.

export interface Migration {
  version: number;
  name: string;
  /** One SQL statement per entry. */
  statements: string[];
}

export const LIBRARY_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    statements: [
      // Optional accounts. ids are app-generated (the anonymous player id today).
      `create table if not exists users (
        id           text primary key,
        display_name text,
        created_at   text not null default (datetime('now'))
      )`,
      // Saved, shareable rulesets - the community library.
      `create table if not exists custom_games (
        id           text primary key,
        slug         text not null unique,
        title        text not null,
        description  text,
        base_game    text,
        ruleset      text not null default '{}',
        creator_id   text references users (id) on delete set null,
        plays_count  integer not null default 0,
        is_public    integer not null default 1,
        created_at   text not null default (datetime('now')),
        updated_at   text not null default (datetime('now'))
      )`,
      `create index if not exists custom_games_slug_idx on custom_games (slug)`,
      // Powers "most-played" sorting on the library page.
      `create index if not exists custom_games_plays_idx on custom_games (plays_count desc)`,
    ],
  },
  {
    version: 2,
    name: "profiles",
    statements: [
      // Track last-seen for sorting.
      `alter table users add column updated_at text`,
      // A player's favorited custom games.
      `create table if not exists favorites (
        user_id    text not null,
        slug       text not null,
        created_at text not null default (datetime('now')),
        primary key (user_id, slug)
      )`,
      `create index if not exists favorites_user_idx on favorites (user_id)`,
      `create index if not exists favorites_slug_idx on favorites (slug)`,
      // Find a creator's games fast (public profile pages).
      `create index if not exists custom_games_creator_idx on custom_games (creator_id)`,
    ],
  },
  {
    version: 3,
    name: "player_auth",
    statements: [
      // Per-player write authentication. The anonymous player id is public (it
      // appears in presence, game views, and /u/<id> URLs), so on its own it
      // can't prove ownership. Each browser also generates a private secret; the
      // first time an id writes, its hash is bound here (trust-on-first-use).
      `create table if not exists player_auth (
        player_id   text primary key,
        secret_hash text not null,
        created_at  text not null default (datetime('now'))
      )`,
    ],
  },
];
