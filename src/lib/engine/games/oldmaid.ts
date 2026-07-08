// Old Maid - one Queen removed so a single card can never pair. Draw blind from a
// neighbor, discard pairs; whoever is left holding the odd Queen is the Old Maid.

import { standardDeck, type Card, type Rank, shuffle } from "../cards";
import { makeRng } from "../rng";
import { nextActiveIndex, type ApplyResult, type GameDefinition, type GameStatus, type GameView, type PlayerId, type SeatInfo } from "../types";

interface OldMaidState {
  type: "oldmaid";
  seed: number;
  rules: string[];
  players: SeatInfo[];
  hands: Card[][];
  discardCount: number;
  turn: number;
  over: boolean;
  loser: number | null;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

/** Remove pairs within a single hand; returns kept cards + how many were discarded. */
function discardPairs(hand: Card[]): { hand: Card[]; discarded: number } {
  const byRank = new Map<Rank, Card[]>();
  for (const c of hand) {
    const arr = byRank.get(c.r) ?? [];
    arr.push(c);
    byRank.set(c.r, arr);
  }
  const kept: Card[] = [];
  let discarded = 0;
  for (const arr of byRank.values()) {
    const pairs = Math.floor(arr.length / 2);
    discarded += pairs * 2;
    if (arr.length % 2 === 1) kept.push(arr[arr.length - 1]); // keep the odd one
  }
  return { hand: kept, discarded };
}

function dirOf(rules: string[]): 1 | -1 {
  return rules.includes("oldmaid-draw-right") ? -1 : 1;
}

export const oldmaid: GameDefinition<OldMaidState> = {
  type: "oldmaid",
  name: "Old Maid",
  blurb: "Match and discard pairs. Don't be the one left holding the odd Queen.",
  minPlayers: 2,
  maxPlayers: 6,

  init(players, rules, seed) {
    // Remove one Queen so exactly one card is forever unpaired.
    const deck = shuffle(
      standardDeck().filter((c) => !(c.r === 12 && c.s === "C")),
      makeRng(seed),
    );
    const hands: Card[][] = players.map(() => []);
    deck.forEach((c, i) => hands[i % players.length].push(c));
    let discardCount = 0;
    if (!rules.includes("oldmaid-no-auto-discard")) {
      for (let i = 0; i < players.length; i++) {
        const r = discardPairs(hands[i]);
        hands[i] = r.hand;
        discardCount += r.discarded;
      }
    }
    // First turn: the first player who still holds cards.
    let turn = 0;
    for (let i = 0; i < players.length; i++) {
      if (hands[i].length > 0) { turn = i; break; }
    }
    return {
      type: "oldmaid",
      seed,
      rules,
      players,
      hands,
      discardCount,
      turn,
      over: false,
      loser: null,
      log: ["Pairs discarded. Draw from your neighbor."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const src = sourceSeat(state);
    if (src < 0) return [];
    return state.hands[src].map((_, index) => ({ type: "draw", index }));
  },

  apply(state, actor, action): ApplyResult<OldMaidState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    if (action.type !== "draw") return { state, ok: false, error: "Unknown action." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const src = sourceSeat(state);
    if (src < 0) return { state, ok: false, error: "No one to draw from." };
    const index = action.index as number;
    if (typeof index !== "number" || index < 0 || index >= state.hands[src].length)
      return { state, ok: false, error: "Pick a card to draw." };

    const hands = state.hands.map((h) => h.slice());
    const drawn = hands[src].splice(index, 1)[0];
    let discardCount = state.discardCount;
    let log = state.log;

    // Does the drawn card pair with one already in hand?
    const matchIdx = hands[seat].findIndex((c) => c.r === drawn.r);
    if (matchIdx >= 0) {
      hands[seat].splice(matchIdx, 1); // remove the match; drawn card not added
      discardCount += 2;
      log = push(log, `${state.players[seat].name} drew and discarded a pair.`);
    } else {
      hands[seat].push(drawn);
      log = push(log, `${state.players[seat].name} drew a card.`);
    }

    // How many players still hold cards?
    const withCards = hands.filter((h) => h.length > 0).length;
    let over = false;
    let loser: number | null = null;
    if (withCards <= 1) {
      over = true;
      loser = hands.findIndex((h) => h.length > 0);
      if (loser >= 0) log = push(log, `${state.players[loser].name} is the Old Maid!`);
      else log = push(log, "Everyone paired off - a rare clean sweep!");
    }

    const dir = dirOf(state.rules);
    const nextTurn = over
      ? state.turn
      : nextActiveIndex(state.players.length, state.turn, dir, (i) => hands[i].length === 0);

    return {
      ok: true,
      state: { ...state, hands, discardCount, turn: nextTurn, over, loser, log },
    };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    const src = state.over ? -1 : sourceSeat(state);
    return {
      type: "oldmaid",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: state.hands[i].length === 0,
        extra: { isSource: i === src },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        sourceId: src >= 0 ? state.players[src].id : null,
        sourceCount: src >= 0 ? state.hands[src].length : 0,
        discardCount: state.discardCount,
      },
      status: this.status(state),
      log: state.log,
      rules: state.rules,
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const losers = state.loser === null ? [] : [state.players[state.loser].id];
    const winners = state.players.filter((_, i) => i !== state.loser).map((p) => p.id);
    return {
      over: true,
      winners,
      losers,
      message: state.loser === null ? "A clean sweep!" : `${state.players[state.loser].name} is the Old Maid!`,
    };
  },
};

/** The seat the current player draws from (next active seat in draw direction). */
function sourceSeat(state: OldMaidState): number {
  const dir = dirOf(state.rules);
  const src = nextActiveIndex(state.players.length, state.turn, dir, (i) => state.hands[i].length === 0 || i === state.turn);
  return state.hands[src].length > 0 && src !== state.turn ? src : -1;
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
}
