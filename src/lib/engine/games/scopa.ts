// Scopa (2 players) - a 40-card deck (A–10). Play a card; if it matches a table
// card's value you take it, else if it sums with a set of table cards you take
// those. Clear the whole table for a "scopa" (sweep). Score cards, coins (♦), the
// sette bello (7♦), and the primiera. Captures auto-resolve (singles first, then
// the smallest summing set) to keep a one-tap turn.

import { standardDeck, shuffle, type Card, type Suit } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, SeatInfo } from "../types";

const COIN: Suit = "D"; // the "coins" suit
const value = (c: Card) => c.r; // A=1 … 10=10
const PRIME: Record<number, number> = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };

interface ScopaState {
  type: "scopa";
  seed: number;
  players: SeatInfo[]; // 2
  hands: Card[][];
  table: Card[];
  captured: Card[][];
  scope: [number, number];
  deck: Card[];
  turn: number;
  lastCapturer: number;
  over: boolean;
  scores: [number, number];
  breakdown: string;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
function key(c: Card) {
  return `${c.r}${c.s}`;
}

/** Smallest subset of `table` (size ≥ 2) summing to v, or null. */
function findSum(table: Card[], v: number): Card[] | null {
  let best: Card[] | null = null;
  const dfs = (start: number, sum: number, picked: Card[]) => {
    if (sum === v && picked.length >= 2) {
      if (!best || picked.length < best.length) best = picked.slice();
      return;
    }
    if (sum >= v) return;
    for (let i = start; i < table.length; i++) dfs(i + 1, sum + value(table[i]), [...picked, table[i]]);
  };
  dfs(0, 0, []);
  return best;
}

function scoreHand(state: ScopaState): { scores: [number, number]; breakdown: string } {
  const cap = state.captured;
  const cards = [cap[0].length, cap[1].length];
  const coins = [cap[0].filter((c) => c.s === COIN).length, cap[1].filter((c) => c.s === COIN).length];
  const sette = [cap[0].some((c) => c.r === 7 && c.s === COIN), cap[1].some((c) => c.r === 7 && c.s === COIN)];
  const prime = [0, 1].map((p) => {
    const suits: Record<string, number> = {};
    for (const c of cap[p]) suits[c.s] = Math.max(suits[c.s] ?? 0, PRIME[c.r] ?? 0);
    return (["S", "H", "D", "C"] as Suit[]).reduce((n, s) => n + (suits[s] ?? 0), 0);
  });
  const scores: [number, number] = [state.scope[0], state.scope[1]];
  const award = (a: number, b: number, label: string, parts: string[]) => {
    if (a > b) { scores[0] += 1; parts.push(`P0 ${label}`); }
    else if (b > a) { scores[1] += 1; parts.push(`P1 ${label}`); }
  };
  const parts: string[] = [];
  if (state.scope[0]) parts.push(`P0 ${state.scope[0]} scopa`);
  if (state.scope[1]) parts.push(`P1 ${state.scope[1]} scopa`);
  award(cards[0], cards[1], "cards", parts);
  award(coins[0], coins[1], "coins", parts);
  if (sette[0] !== sette[1]) { scores[sette[0] ? 0 : 1] += 1; parts.push(`${sette[0] ? "P0" : "P1"} settebello`); }
  award(prime[0], prime[1], "primiera", parts);
  return { scores, breakdown: parts.join(" · ") || "even" };
}

export const scopa: GameDefinition<ScopaState> = {
  type: "scopa",
  name: "Scopa",
  blurb: "Capture table cards by matching or summing to them. Sweep the table for a scopa.",
  minPlayers: 2,
  maxPlayers: 2,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck().filter((c) => c.r <= 10), makeRng(seed));
    const hands = [deck.slice(0, 3), deck.slice(3, 6)];
    const table = deck.slice(6, 10);
    return {
      type: "scopa",
      seed,
      players: players.slice(0, 2),
      hands,
      table,
      captured: [[], []],
      scope: [0, 0],
      deck: deck.slice(10),
      turn: 0,
      lastCapturer: 0,
      over: false,
      scores: [0, 0],
      breakdown: "",
      log: ["Play a card - match or sum to capture."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    return state.hands[seat].map((card) => ({ type: "play", card }));
  },

  apply(state, actor, action): ApplyResult<ScopaState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    if (action.type !== "play") return { state, ok: false, error: "Play a card." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const card = action.card as Card;
    const hand = state.hands[seat];
    if (!hand.some((c) => c.r === card.r && c.s === card.s)) return { state, ok: false, error: "You don't hold that." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
    let table = state.table.slice();
    const captured = state.captured.map((c) => c.slice());
    const scope: [number, number] = [state.scope[0], state.scope[1]];
    let lastCapturer = state.lastCapturer;
    let log = state.log;
    let deck = state.deck.slice();

    const v = value(card);
    const singles = table.filter((c) => value(c) === v);
    let taken: Card[] = [];
    if (singles.length > 0) taken = [singles[0]];
    else taken = findSum(table, v) ?? [];

    if (taken.length > 0) {
      const takenKeys = new Set(taken.map(key));
      table = table.filter((c) => !takenKeys.has(key(c)));
      captured[seat].push(...taken, card);
      lastCapturer = seat;
      const willContinue = deck.length > 0 || hands[0].length > 0 || hands[1].length > 0;
      if (table.length === 0 && willContinue) {
        scope[seat] += 1;
        log = push(log, `${state.players[seat].name} sweeps - scopa!`);
      } else {
        log = push(log, `${state.players[seat].name} captures ${taken.length + 1}.`);
      }
    } else {
      table.push(card);
      log = push(log, `${state.players[seat].name} trails ${card.r}${card.s}.`);
    }

    let turn = seat === 0 ? 1 : 0;

    // Refill hands when both are empty.
    if (hands[0].length === 0 && hands[1].length === 0) {
      if (deck.length > 0) {
        hands[0] = deck.slice(0, 3);
        hands[1] = deck.slice(3, 6);
        deck = deck.slice(6);
        turn = 0;
      } else {
        // End: leftover table goes to the last capturer.
        captured[lastCapturer].push(...table);
        table = [];
        const scored = scoreHand({ ...state, captured, scope });
        return {
          ok: true,
          state: { ...state, hands, table, captured, scope, deck, over: true, scores: scored.scores, breakdown: scored.breakdown, log: push(log, `Round over - ${scored.breakdown}.`) },
        };
      }
    }

    return { ok: true, state: { ...state, hands, table, captured, scope, deck, turn, lastCapturer, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "scopa",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: false,
        extra: { captured: state.captured[i].length, scope: state.scope[i], score: state.over ? state.scores[i] : undefined },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? [...state.hands[seat]].sort((a, b) => a.r - b.r) : [],
      legal: this.legalActions(state, viewer),
      center: { table: state.table, deckCount: state.deck.length },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    if (state.scores[0] === state.scores[1]) return { over: true, winners: [], losers: [], message: `Tie ${state.scores[0]}–${state.scores[1]}.` };
    const w = state.scores[0] > state.scores[1] ? 0 : 1;
    return { over: true, winners: [state.players[w].id], losers: [state.players[w === 0 ? 1 : 0].id], message: `${state.players[w].name} wins ${state.scores[w]}–${state.scores[w === 0 ? 1 : 0]}.` };
  },
};
