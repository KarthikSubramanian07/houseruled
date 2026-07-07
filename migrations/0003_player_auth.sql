-- Per-player write authentication. The anonymous localStorage id is public
-- (it appears in presence, game views, and /u/<id> URLs), so on its own it can't
-- prove ownership. Each browser also generates a private secret; the first time
-- an id writes, we bind the secret's hash here (trust-on-first-use). Subsequent
-- profile/game/favorite writes must present the matching secret.
create table if not exists player_auth (
  player_id   text primary key,
  secret_hash text not null,
  created_at  text not null default (datetime('now'))
);
