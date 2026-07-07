// Casino (2 players) — the fishing game. Play a card to capture table cards by
// matching a rank (pairing, works for face cards) or by summing number cards to
// your card's value. You choose exactly what to take, so which cards you grab
// matters: score most-cards (3), most-spades (1), 10♦ "big casino" (2), 2♠
// "little casino" (1), each ace (1), and each sweep (1). Clearing the whole
// table is a sweep. First to 21 across deals wins.

import { standardDeck, shuffle, type Card, type Rank } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, SeatInfo } from "../types";

const TARGET = 21; // match total across deals
const key = (c: Card) => `${c.r}${c.s}`;
/** Numeric capture value: A=1 … 10; face cards have none (capture by pairing only). */
const numVal = (c: Card): number | null => (c.r >= 11 ? null : c.r);

interface CasinoState {
  type: "casino";
  seed: number;
  deal: number; // deal counter (reseeds the shuffle per deal)
  players: SeatInfo[]; // 2
  hands: Card[][];
  table: Card[];
  captured: Card[][];
  sweeps: [number, number];
  deck: Card[];
  turn: number;
  dealer: number;
  lastCapturer: number;
  total: [number, number]; // running match score
  over: boolean;
  dealtOver: boolean; // deck + hands exhausted this deal
  scores: [number, number]; // last deal's points
  breakdown: string;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

/** Smallest subset of `pool` (number cards) summing to exactly v, or null. */
function subsetSum(pool: Card[], v: number): Card[] | null {
  let best: Card[] | null = null;
  const dfs = (start: number, sum: number, picked: Card[]) => {
    if (sum === v && picked.length >= 1) {
      if (!best || picked.length < best.length) best = picked.slice();
      return;
    }
    if (sum >= v) return;
    for (let i = start; i < pool.length; i++) dfs(i + 1, sum + (numVal(pool[i]) as number), [...picked, pool[i]]);
  };
  dfs(0, 0, []);
  return best;
}

/** Can `cards` be exactly partitioned into valid capture groups for a card of value v / rank? */
function partitionable(cards: Card[], v: number | null, rank: Rank): boolean {
  if (cards.length === 0) return true;
  const first = cards[0];
  const rest = cards.slice(1);
  // Group A: pair — first card matches the played rank, captured on its own.
  if (first.r === rank && partitionable(rest, v, rank)) return true;
  // Group B: sum — first is a number card that starts a group totalling v.
  const fv = numVal(first);
  if (v != null && fv != null && fv <= v) {
    const need = v - fv;
    if (need === 0) {
      if (partitionable(rest, v, rank)) return true;
    } else {
      const numbered = rest.filter((c) => numVal(c) != null);
      // Enumerate subsets of the remaining number cards summing to `need`.
      const enumerate = (start: number, sum: number, picked: Card[]): boolean => {
        if (sum === need) {
          const used = new Set(picked.map(key));
          return partitionable(rest.filter((c) => !used.has(key(c))), v, rank);
        }
        if (sum > need) return false;
        for (let i = start; i < numbered.length; i++) {
          if (enumerate(i + 1, sum + (numVal(numbered[i]) as number), [...picked, numbered[i]])) return true;
        }
        return false;
      };
      if (enumerate(0, 0, [])) return true;
    }
  }
  return false;
}

/** Client-safe check: does `targets` form a legal capture for `card`? (shared with the UI) */
export function validCapture(targets: Card[], card: Card): boolean {
  return targets.length > 0 && partitionable(targets, numVal(card), card.r);
}

/** The largest deterministic capture a card can make: all pairs, then greedy sum-groups. */
function maximalCapture(table: Card[], card: Card): Card[] {
  const v = numVal(card);
  const used = new Set<string>();
  const targets: Card[] = [];
  for (const c of table) if (c.r === card.r) { targets.push(c); used.add(key(c)); }
  if (v != null) {
    let pool = table.filter((c) => !used.has(key(c)) && numVal(c) != null);
    let grp = subsetSum(pool, v);
    while (grp) {
      for (const c of grp) { targets.push(c); used.add(key(c)); }
      pool = pool.filter((c) => !used.has(key(c)));
      grp = subsetSum(pool, v);
    }
  }
  return targets;
}

function scoreDeal(captured: Card[][], sweeps: [number, number]): { pts: [number, number]; breakdown: string } {
  const pts: [number, number] = [sweeps[0], sweeps[1]];
  const parts: string[] = [];
  if (sweeps[0]) parts.push(`P0 ${sweeps[0]} sweep${sweeps[0] > 1 ? "s" : ""}`);
  if (sweeps[1]) parts.push(`P1 ${sweeps[1]} sweep${sweeps[1] > 1 ? "s" : ""}`);
  const cards = [captured[0].length, captured[1].length];
  if (cards[0] !== cards[1]) { const w = cards[0] > cards[1] ? 0 : 1; pts[w] += 3; parts.push(`P${w} most cards`); }
  const spades = [captured[0].filter((c) => c.s === "S").length, captured[1].filter((c) => c.s === "S").length];
  if (spades[0] !== spades[1]) { const w = spades[0] > spades[1] ? 0 : 1; pts[w] += 1; parts.push(`P${w} most spades`); }
  const big = captured.findIndex((cap) => cap.some((c) => c.r === 10 && c.s === "D"));
  if (big >= 0) { pts[big] += 2; parts.push(`P${big} big casino`); }
  const little = captured.findIndex((cap) => cap.some((c) => c.r === 2 && c.s === "S"));
  if (little >= 0) { pts[little] += 1; parts.push(`P${little} little casino`); }
  for (const p of [0, 1]) {
    const aces = captured[p].filter((c) => c.r === 1).length;
    if (aces) { pts[p] += aces; parts.push(`P${p} ${aces} ace${aces > 1 ? "s" : ""}`); }
  }
  return { pts, breakdown: parts.join(" · ") || "even" };
}

function deal(state: CasinoState, dealer: number): CasinoState {
  const deck = shuffle(standardDeck(), makeRng(state.seed + state.deal * 101));
  const hands = [deck.slice(0, 4), deck.slice(4, 8)];
  const table = deck.slice(8, 12);
  return {
    ...state,
    hands,
    table,
    deck: deck.slice(12),
    turn: (dealer + 1) % 2, // non-dealer leads
    dealer,
    lastCapturer: (dealer + 1) % 2,
    dealtOver: false,
    log: push(state.log, `Deal ${state.deal + 1} — ${state.players[(dealer + 1) % 2].name} leads.`),
  };
}

export const casino: GameDefinition<CasinoState> = {
  type: "casino",
  name: "Casino",
  blurb: "Capture cards by matching or summing. Grab the aces, spades, and 10♦ — every card counts.",
  minPlayers: 2,
  maxPlayers: 2,

  init(players, _rules, seed) {
    const base: CasinoState = {
      type: "casino",
      seed,
      deal: 0,
      players: players.slice(0, 2),
      hands: [[], []],
      table: [],
      captured: [[], []],
      sweeps: [0, 0],
      deck: [],
      turn: 0,
      dealer: 1,
      lastCapturer: 0,
      total: [0, 0],
      over: false,
      dealtOver: false,
      scores: [0, 0],
      breakdown: "",
      log: ["Capture by matching a rank or summing to your card."],
    };
    return deal(base, 1);
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const actions: { type: string; card: Card; targets?: Card[] }[] = [];
    for (const card of state.hands[seat]) {
      const targets = maximalCapture(state.table, card);
      if (targets.length > 0) actions.push({ type: "capture", card, targets });
      actions.push({ type: "trail", card });
    }
    return actions;
  },

  apply(state, actor, action): ApplyResult<CasinoState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    if (action.type !== "capture" && action.type !== "trail") return { state, ok: false, error: "Capture or trail a card." };

    const card = action.card as Card;
    if (!state.hands[seat].some((c) => key(c) === key(card))) return { state, ok: false, error: "You don't hold that." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => key(c) !== key(card));
    let table = state.table.slice();
    const captured = state.captured.map((c) => c.slice());
    const sweeps: [number, number] = [state.sweeps[0], state.sweeps[1]];
    let lastCapturer = state.lastCapturer;
    let log = state.log;

    if (action.type === "capture") {
      const targets = (action.targets as Card[]) ?? [];
      if (targets.length === 0) return { state, ok: false, error: "Choose cards to capture." };
      if (new Set(targets.map(key)).size !== targets.length) return { state, ok: false, error: "Duplicate cards in that capture." };
      const tableKeys = new Set(table.map(key));
      if (!targets.every((t) => tableKeys.has(key(t)))) return { state, ok: false, error: "Those cards aren't on the table." };
      if (!partitionable(targets, numVal(card), card.r)) return { state, ok: false, error: "That set doesn't pair or sum to your card." };
      const takeKeys = new Set(targets.map(key));
      table = table.filter((c) => !takeKeys.has(key(c)));
      captured[seat].push(...targets, card);
      lastCapturer = seat;
      if (table.length === 0) {
        sweeps[seat] += 1;
        log = push(log, `${state.players[seat].name} sweeps the table!`);
      } else {
        log = push(log, `${state.players[seat].name} captures ${targets.length}.`);
      }
    } else {
      table.push(card);
      log = push(log, `${state.players[seat].name} trails ${key(card)}.`);
    }

    let turn = (seat + 1) % 2;
    let deck = state.deck.slice();

    // Refill / deal transitions once both hands are empty.
    if (hands[0].length === 0 && hands[1].length === 0) {
      if (deck.length >= 8) {
        hands[0] = deck.slice(0, 4);
        hands[1] = deck.slice(4, 8);
        deck = deck.slice(8);
        turn = (state.dealer + 1) % 2;
      } else {
        // Deal is done: sweep-up leftover table to the last capturer, then score.
        captured[lastCapturer].push(...table);
        table = [];
        const { pts, breakdown } = scoreDeal(captured, sweeps);
        const total: [number, number] = [state.total[0] + pts[0], state.total[1] + pts[1]];
        const done = (total[0] >= TARGET || total[1] >= TARGET) && total[0] !== total[1];
        const next: CasinoState = {
          ...state, hands, table, captured, sweeps, deck, turn, lastCapturer,
          total, scores: pts, breakdown, dealtOver: true,
          log: push(log, `Deal scored — ${breakdown}. Match ${total[0]}–${total[1]}.`),
        };
        if (done) return { ok: true, state: { ...next, over: true } };
        // Start the next deal; the deal passes.
        const fresh: CasinoState = {
          ...next,
          deal: state.deal + 1,
          captured: [[], []],
          sweeps: [0, 0],
        };
        return { ok: true, state: deal(fresh, (state.dealer + 1) % 2) };
      }
    }

    return { ok: true, state: { ...state, hands, table, captured, sweeps, deck, turn, lastCapturer, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "casino",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: false,
        extra: { captured: state.captured[i].length, sweeps: state.sweeps[i], total: state.total[i] },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? [...state.hands[seat]].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r) : [],
      legal: this.legalActions(state, viewer),
      center: {
        table: state.table,
        deckCount: state.deck.length,
        deal: state.deal + 1,
        total: state.total,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const w = state.total[0] > state.total[1] ? 0 : 1;
    return {
      over: true,
      winners: [state.players[w].id],
      losers: [state.players[(w + 1) % 2].id],
      message: `${state.players[w].name} wins the match ${state.total[w]}–${state.total[(w + 1) % 2]}.`,
    };
  },
};
