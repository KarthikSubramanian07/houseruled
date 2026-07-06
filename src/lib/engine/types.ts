// The engine contract. Every game implements GameDefinition and stores its own
// state shape S. The Durable Object holds { type, state } opaquely and dispatches
// through the registry — it never trusts the client, and it projects a per-viewer
// GameView so a player only ever sees their own hand.

import type { Card } from "./cards";

export type PlayerId = string;

/** A player seated when the game starts. Order is fixed for the game's lifetime. */
export interface SeatInfo {
  id: PlayerId;
  name: string;
}

/** A generic action from a client; each game narrows/validates it. */
export interface Action {
  type: string;
  [key: string]: unknown;
}

export interface GameStatus {
  over: boolean;
  winners: PlayerId[];
  losers: PlayerId[];
  /** Human-readable outcome, e.g. "Alice wins!" or "Push." */
  message?: string;
}

/** Public, per-player info everyone can see (never includes hidden cards). */
export interface PlayerPublic {
  id: PlayerId;
  name: string;
  handCount: number;
  isTurn: boolean;
  out: boolean;
  /** Game-specific public extras (books, up-cards, total, declared-out, …). */
  extra?: Record<string, unknown>;
}

/** The projection a single viewer receives. Hidden info is never included. */
export interface GameView {
  type: string;
  you: PlayerId;
  players: PlayerPublic[];
  turn: PlayerId | null;
  /** The viewer's own cards, face up. */
  hand: Card[];
  /** Actions the viewer may legally take right now. */
  legal: Action[];
  /** Game-specific public center state (discard top, pool count, dealer, …). */
  center: Record<string, unknown>;
  status: GameStatus;
  /** Recent event-log lines, newest last. */
  log: string[];
  /** Active Phase-2 house-rule ids, for display on the plaque. */
  rules: string[];
  /** Active Phase-3 free-text rules (id, original text, effect summary). */
  aiRules?: { id: string; raw: string; summary: string }[];
}

export interface ApplyResult<S> {
  state: S;
  ok: boolean;
  error?: string;
}

export interface GameDefinition<S = unknown> {
  type: string;
  name: string;
  blurb: string;
  minPlayers: number;
  maxPlayers: number;
  /** Build initial state. `seed` seeds all shuffles (stored in state). */
  init(players: SeatInfo[], rules: string[], seed: number): S;
  /** Legal actions for `viewer` given current state (empty if not their turn). */
  legalActions(state: S, viewer: PlayerId): Action[];
  /** Validate + apply an action by `actor`. Returns ok:false with a reason if illegal. */
  apply(state: S, actor: PlayerId, action: Action): ApplyResult<S>;
  /** Project state to what `viewer` may see. */
  view(state: S, viewer: PlayerId): GameView;
  status(state: S): GameStatus;
}

// ── Shared turn helpers ───────────────────────────────────────────────────────

/**
 * Index of the next player who is still in, moving `dir` (+1 / -1) around the
 * table, optionally skipping `skip` additional active players (for skip rules).
 * Returns the same index if nobody else is active.
 */
export function nextActiveIndex(
  count: number,
  from: number,
  dir: 1 | -1,
  isOut: (i: number) => boolean,
  skip = 0,
): number {
  let i = from;
  let hops = skip + 1;
  for (let guard = 0; guard < count * (skip + 2) + 2 && hops > 0; guard++) {
    i = (i + dir + count) % count;
    if (!isOut(i)) hops--;
  }
  return i;
}
