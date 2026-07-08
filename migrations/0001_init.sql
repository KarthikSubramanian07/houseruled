-- ═══════════════════════════════════════════════════════════════════════════
-- Houseruled - D1 (SQLite) schema
--
-- Live rooms and game state do NOT live here - each room is a Durable Object
-- (see src/server/room-do.ts), addressed by its code. D1 holds the durable,
-- queryable library: saved custom games (Phase 4/5) and optional accounts
-- (Phase 5). Empty at Phase 0; defined now so the schema is stable.
--
-- D1 has no row-level security; access is enforced in the Worker/route layer.
-- ═══════════════════════════════════════════════════════════════════════════

-- Optional accounts (Phase 5). ids are app-generated (e.g. from the auth layer).
create table if not exists users (
  id           text primary key,
  display_name text,
  created_at   text not null default (datetime('now'))
);

-- Saved, shareable rulesets - the community library (Phase 4/5).
create table if not exists custom_games (
  id           text primary key,
  slug         text not null unique,
  title        text not null,
  description  text,
  base_game    text,                          -- e.g. 'crazy_eights', or null if from scratch
  ruleset      text not null default '{}',     -- JSON (rule objects, Phase 3 schema)
  creator_id   text references users (id) on delete set null,
  plays_count  integer not null default 0,
  is_public    integer not null default 1,     -- 0/1 boolean
  created_at   text not null default (datetime('now')),
  updated_at   text not null default (datetime('now'))
);

create index if not exists custom_games_slug_idx on custom_games (slug);
-- Powers "most-played" sorting / top-50 on the home page (Phase 5).
create index if not exists custom_games_plays_idx on custom_games (plays_count desc);
