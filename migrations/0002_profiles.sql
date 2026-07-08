-- Profiles + favorites (Phase 5). Identity is the player's id - the anonymous
-- localStorage id today, upgradeable to a Google-auth'd id later without schema
-- change (same `users.id`). Profiles are public and queryable by id.

-- users already exists (id, display_name, created_at). Track last-seen for sorting.
alter table users add column updated_at text;

-- A player's favorited custom games.
create table if not exists favorites (
  user_id    text not null,
  slug       text not null,
  created_at text not null default (datetime('now')),
  primary key (user_id, slug)
);

create index if not exists favorites_user_idx on favorites (user_id);
create index if not exists favorites_slug_idx on favorites (slug);
-- Find a creator's games fast (public profile pages).
create index if not exists custom_games_creator_idx on custom_games (creator_id);
