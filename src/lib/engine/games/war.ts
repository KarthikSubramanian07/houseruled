// War - the simplest game, validates the engine end-to-end. Two players, no
// hidden hands (cards sit in face-down stacks). A single "flip" action resolves a
// whole battle atomically (including any wars) so there's no multi-step war UI.

import { standardDeck, shuffle, type Card, type Rank } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, SeatInfo } from "../types";

interface Battle {
  a: Card;
  b: Card;
  war: boolean;
  winner: number | null; // seat index, or null if a player ran out
  taken: number;
}

interface WarState {
  type: "war";
  seed: number;
  rules: string[];
  players: SeatInfo[]; // exactly 2
  stacks: [Card[], Card[]]; // face-down; index 0 = top
  turn: number; // seat index of who flips next
  rounds: number;
  last: Battle | null;
  over: boolean;
  winner: number | null;
  log: string[];
}

// War can cycle forever with a fixed won-card order; a round cap guarantees the
// game always ends (leader takes it if time is called).
const MAX_ROUNDS = 3000;

function warValue(r: Rank, acesLow: boolean): number {
  if (acesLow) return r; // Ace = 1 (lowest)
  return r === 1 ? 14 : r; // Ace high
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-8);
}

export const war: GameDefinition<WarState> = {
  type: "war",
  name: "War",
  blurb: "Flip cards, high card wins. Ties mean war. Pure luck, pure chaos.",
  minPlayers: 2,
  maxPlayers: 2,

  init(players, rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    return {
      type: "war",
      seed,
      rules,
      players: players.slice(0, 2),
      stacks: [deck.slice(0, 26), deck.slice(26)],
      turn: 0,
      rounds: 0,
      last: null,
      over: false,
      winner: null,
      log: ["The cards are cut. Flip to begin."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    if (state.players[state.turn]?.id !== viewer) return [];
    return [{ type: "flip" }];
  },

  apply(state, actor, action): ApplyResult<WarState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    if (action.type !== "flip") return { state, ok: false, error: "Unknown action." };
    if (state.players[state.turn]?.id !== actor)
      return { state, ok: false, error: "Not your turn to flip." };

    const acesLow = state.rules.includes("war-aces-low");
    const downCount = state.rules.includes("war-one-card") ? 1 : 3;

    const stacks: [Card[], Card[]] = [state.stacks[0].slice(), state.stacks[1].slice()];
    const pile: Card[] = [];
    let war = false;
    let winner: number | null = null;
    let a: Card | null = null;
    let b: Card | null = null;

    // Resolve a full battle (loop through any wars) atomically.
    for (let guard = 0; guard < 60; guard++) {
      if (stacks[0].length === 0) { winner = 1; break; }
      if (stacks[1].length === 0) { winner = 0; break; }
      a = stacks[0].shift()!;
      b = stacks[1].shift()!;
      pile.push(a, b);
      const va = warValue(a.r, acesLow);
      const vb = warValue(b.r, acesLow);
      if (va > vb) { winner = 0; break; }
      if (vb > va) { winner = 1; break; }
      // Tie → war: each buries `downCount` cards (or as many as they can).
      war = true;
      for (let k = 0; k < downCount; k++) {
        if (stacks[0].length > 1) pile.push(stacks[0].shift()!);
        if (stacks[1].length > 1) pile.push(stacks[1].shift()!);
      }
    }

    // Award the pile to the winner, shuffled, at the bottom of their stack.
    // Shuffling the won cards breaks the deterministic cycles that make War loop.
    const rounds = state.rounds + 1;
    if (winner !== null) {
      const rng = makeRng(state.seed + rounds);
      stacks[winner] = stacks[winner].concat(shuffle(pile, rng));
    }

    const battle: Battle = { a: a!, b: b!, war, winner, taken: pile.length };
    let log = state.log;
    if (winner !== null && a && b) {
      const wname = state.players[winner].name;
      log = push(log, `${war ? "War! " : ""}${wname} takes ${pile.length} cards.`);
    }

    let over = false;
    let gameWinner: number | null = null;
    if (stacks[0].length === 0) { over = true; gameWinner = 1; }
    else if (stacks[1].length === 0) { over = true; gameWinner = 0; }
    else if (rounds >= MAX_ROUNDS) {
      // Time called - the bigger stack wins.
      over = true;
      gameWinner = stacks[0].length >= stacks[1].length ? 0 : 1;
      log = push(log, "Time called on a marathon war.");
    }
    if (over) log = push(log, `${state.players[gameWinner!].name} wins the war!`);

    return {
      ok: true,
      state: {
        ...state,
        stacks,
        turn: state.turn === 0 ? 1 : 0,
        rounds,
        last: battle,
        over,
        winner: gameWinner,
        log,
      },
    };
  },

  view(state, viewer): GameView {
    return {
      type: "war",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.stacks[i].length,
        isTurn: !state.over && state.turn === i,
        out: state.over && state.winner !== i,
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: [], // War has no hand - cards are in face-down stacks
      legal: this.legalActions(state, viewer),
      center: {
        battle: state.last,
        seats: state.players.map((p) => p.id),
      },
      status: this.status(state),
      log: state.log,
      rules: state.rules,
    };
  },

  status(state): GameStatus {
    if (!state.over || state.winner === null) return { over: false, winners: [], losers: [] };
    const w = state.players[state.winner];
    const l = state.players[state.winner === 0 ? 1 : 0];
    return { over: true, winners: [w.id], losers: [l.id], message: `${w.name} wins!` };
  },
};
