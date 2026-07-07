// Game registry. The Durable Object holds { type, state } opaquely and dispatches
// through here — it never needs to know a specific game's internals.

import type { Action, GameDefinition, GameView, SeatInfo } from "./types";
import type { AIRule } from "./airules";
import { war } from "./games/war";
import { gofish } from "./games/gofish";
import { oldmaid } from "./games/oldmaid";
import { crazyeights } from "./games/crazyeights";
import { blackjack } from "./games/blackjack";
import { hearts } from "./games/hearts";
import { spades } from "./games/spades";
import { euchre } from "./games/euchre";
import { cheat } from "./games/cheat";
import { ohhell } from "./games/ohhell";
import { gin } from "./games/gin";
import { scopa } from "./games/scopa";
import { pitch } from "./games/pitch";
import { casino } from "./games/casino";
import { cribbage } from "./games/cribbage";
import { fivehundred } from "./games/fivehundred";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LIST: GameDefinition<any>[] = [war, gofish, oldmaid, crazyeights, blackjack, hearts, spades, euchre, cheat, ohhell, gin, scopa, pitch, casino, cribbage, fivehundred];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: Record<string, GameDefinition<any>> = Object.fromEntries(
  LIST.map((g) => [g.type, g]),
);

export interface GameMeta {
  type: string;
  name: string;
  blurb: string;
  minPlayers: number;
  maxPlayers: number;
}

/** Lightweight catalog for the pre-game picker (order = rising complexity). */
export const GAME_CATALOG: GameMeta[] = LIST.map((g) => ({
  type: g.type,
  name: g.name,
  blurb: g.blurb,
  minPlayers: g.minPlayers,
  maxPlayers: g.maxPlayers,
}));

export function getGame(type: string): GameDefinition | undefined {
  return GAMES[type];
}

// ── Opaque helpers the DO calls (state is `unknown` on its side) ──────────────

export function initGame(type: string, players: SeatInfo[], rules: string[], seed: number): unknown {
  const g = GAMES[type];
  if (!g) throw new Error(`Unknown game: ${type}`);
  return g.init(players, rules, seed);
}

export function applyGame(
  type: string,
  state: unknown,
  actor: string,
  action: Action,
): { state: unknown; ok: boolean; error?: string } {
  const g = GAMES[type];
  if (!g) return { state, ok: false, error: "Unknown game." };
  return g.apply(state, actor, action);
}

export function viewGame(type: string, state: unknown, viewer: string): GameView {
  const g = GAMES[type];
  if (!g) throw new Error(`Unknown game: ${type}`);
  return g.view(state, viewer);
}

/** Whether a game supports free-text (Phase 3) rules. */
export function supportsAIRules(type: string): boolean {
  return type === "crazyeights";
}

/** Read the free-text rules currently attached to a game state. */
export function getAIRules(type: string, state: unknown): AIRule[] {
  if (!supportsAIRules(type)) return [];
  return ((state as { aiRules?: AIRule[] }).aiRules ?? []).slice();
}

/** Attach validated free-text rules to a game state (pre-game or live). */
export function addAIRules(type: string, state: unknown, rules: AIRule[]): unknown {
  if (!supportsAIRules(type) || rules.length === 0) return state;
  const s = state as { aiRules?: AIRule[]; plays?: number };
  const stamped = rules.map((r) => ({ ...r, addedAtPlay: s.plays ?? 0 }));
  return { ...s, aiRules: [...(s.aiRules ?? []), ...stamped] };
}
