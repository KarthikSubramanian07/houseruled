// Gin Rummy (2 players) — draw a card, discard one, form melds (sets of a rank or
// runs of a suit), and knock when your deadwood ≤ 10 (or gin at 0). The heart of
// it is bestMelds(): the minimum-deadwood partition of a hand, used for both
// eligibility and scoring, plus lay-offs against the knocker's melds.

import { standardDeck, shuffle, type Card, type Rank } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, SeatInfo } from "../types";

function dwValue(r: Rank): number {
  return r === 1 ? 1 : r >= 10 ? 10 : r;
}

// ── Best (minimum-deadwood) meld partition ────────────────────────────────────
export interface MeldResult {
  melds: Card[][];
  deadwood: Card[];
  value: number;
}

function addRuns(seg: number[], out: number[][]) {
  for (let start = 0; start < seg.length; start++)
    for (let end = start + 2; end < seg.length; end++) out.push(seg.slice(start, end + 1));
}

export function bestMelds(cards: Card[]): MeldResult {
  const n = cards.length;
  const melds: number[][] = [];

  // Sets: 3–4 of a rank.
  const byRank = new Map<number, number[]>();
  cards.forEach((c, i) => byRank.set(c.r, [...(byRank.get(c.r) ?? []), i]));
  for (const idxs of byRank.values()) {
    if (idxs.length >= 3) melds.push(idxs.slice());
    if (idxs.length === 4) for (let skip = 0; skip < 4; skip++) melds.push(idxs.filter((_, k) => k !== skip));
  }

  // Runs: consecutive ranks in a suit (Ace low).
  const bySuit = new Map<string, number[]>();
  cards.forEach((c, i) => bySuit.set(c.s, [...(bySuit.get(c.s) ?? []), i]));
  for (const idxs of bySuit.values()) {
    const sorted = idxs.slice().sort((a, b) => cards[a].r - cards[b].r);
    let seg: number[] = [];
    for (const idx of sorted) {
      if (seg.length === 0 || cards[idx].r === cards[seg[seg.length - 1]].r + 1) seg.push(idx);
      else {
        addRuns(seg, melds);
        seg = [idx];
      }
    }
    addRuns(seg, melds);
  }

  // DP over the bitmask of used cards → minimum deadwood.
  const memo = new Map<number, { value: number; used: number[][] }>();
  const solve = (mask: number): { value: number; used: number[][] } => {
    const cached = memo.get(mask);
    if (cached) return cached;
    let i = 0;
    while (i < n && mask & (1 << i)) i++;
    if (i === n) return { value: 0, used: [] };
    // leave i as deadwood
    const skip = solve(mask | (1 << i));
    let res = { value: skip.value + dwValue(cards[i].r), used: skip.used };
    for (const m of melds) {
      if (!m.includes(i)) continue;
      if (m.some((j) => mask & (1 << j))) continue;
      let mm = mask;
      for (const j of m) mm |= 1 << j;
      const sub = solve(mm);
      if (sub.value < res.value) res = { value: sub.value, used: [m, ...sub.used] };
    }
    memo.set(mask, res);
    return res;
  };

  const r = solve(0);
  const used = new Set(r.used.flat());
  return {
    melds: r.used.map((m) => m.map((i) => cards[i])),
    deadwood: cards.map((_, i) => i).filter((i) => !used.has(i)).map((i) => cards[i]),
    value: r.value,
  };
}

// Lay off opponent deadwood onto the knocker's melds; return what's still deadwood.
function layOff(knockerMelds: Card[][], deadwood: Card[]): Card[] {
  const melds = knockerMelds.map((m) => m.slice());
  const remaining = deadwood.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      for (const m of melds) {
        const isSet = m.every((x) => x.r === m[0].r);
        if (isSet && c.r === m[0].r && m.length < 4) {
          m.push(c);
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        const isRun = m.every((x) => x.s === m[0].s);
        if (isRun && c.s === m[0].s) {
          const ranks = m.map((x) => x.r).sort((a, b) => a - b);
          if (c.r === ranks[0] - 1 || c.r === ranks[ranks.length - 1] + 1) {
            m.push(c);
            remaining.splice(i, 1);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }
  return remaining;
}

function value(cards: Card[]): number {
  return cards.reduce((n, c) => n + dwValue(c.r), 0);
}

interface GinState {
  type: "gin";
  seed: number;
  players: SeatInfo[]; // 2
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  turn: number;
  phase: "draw" | "discard" | "over";
  over: boolean;
  scores: [number, number];
  outcome: string;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const GIN_BONUS = 25;
const UNDERCUT_BONUS = 25;

export const gin: GameDefinition<GinState> = {
  type: "gin",
  name: "Gin Rummy",
  blurb: "Draw, discard, and build melds. Knock when your deadwood is 10 or less — or go gin.",
  minPlayers: 2,
  maxPlayers: 2,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const hands = [deck.slice(0, 10), deck.slice(10, 20)];
    return {
      type: "gin",
      seed,
      players: players.slice(0, 2),
      hands,
      stock: deck.slice(21),
      discard: [deck[20]],
      turn: 0,
      phase: "draw",
      over: false,
      scores: [0, 0],
      outcome: "",
      log: ["Draw from the stock or the discard."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    if (state.phase === "draw") {
      const a: { type: string }[] = [];
      if (state.stock.length > 0) a.push({ type: "drawStock" });
      if (state.discard.length > 0) a.push({ type: "drawDiscard" });
      return a;
    }
    // discard: for each card, discard (+knock/gin if the resulting hand qualifies)
    const hand = state.hands[seat];
    const actions: { type: string; card: Card }[] = [];
    for (const card of hand) {
      const rest = hand.filter((c) => !(c.r === card.r && c.s === card.s));
      const dw = bestMelds(rest).value;
      actions.push({ type: "discard", card });
      if (dw === 0) actions.push({ type: "gin", card });
      else if (dw <= 10) actions.push({ type: "knock", card });
    }
    return actions;
  },

  apply(state, actor, action): ApplyResult<GinState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const hands = state.hands.map((h) => h.slice());
    let stock = state.stock.slice();
    let discard = state.discard.slice();
    let log = state.log;

    if (state.phase === "draw") {
      if (action.type === "drawStock") {
        if (stock.length === 0) return { state, ok: false, error: "Stock is empty." };
        hands[seat].push(stock.pop()!);
      } else if (action.type === "drawDiscard") {
        if (discard.length === 0) return { state, ok: false, error: "Discard is empty." };
        hands[seat].push(discard.pop()!);
      } else return { state, ok: false, error: "Draw a card." };
      return { ok: true, state: { ...state, hands, stock, discard, phase: "discard", log } };
    }

    // discard phase
    const card = action.card as Card | undefined;
    if (!card) return { state, ok: false, error: "Pick a card." };
    const idx = hands[seat].findIndex((c) => c.r === card.r && c.s === card.s);
    if (idx < 0) return { state, ok: false, error: "You don't hold that card." };
    hands[seat].splice(idx, 1);
    discard.push(card);
    const meld = bestMelds(hands[seat]);

    if (action.type === "knock" || action.type === "gin") {
      const ginHand = meld.value === 0;
      if (action.type === "knock" && meld.value > 10) return { state, ok: false, error: "Deadwood too high to knock." };
      const opp = seat === 0 ? 1 : 0;
      const oppMeld = bestMelds(hands[opp]);
      let oppDw = oppMeld.value;
      let oppDeadwoodCards = oppMeld.deadwood;
      // Lay off is not allowed against gin.
      if (!ginHand) {
        oppDeadwoodCards = layOff(meld.melds, oppMeld.deadwood);
        oppDw = value(oppDeadwoodCards);
      }
      const scores: [number, number] = [0, 0];
      let outcome: string;
      const me = state.players[seat].name;
      const them = state.players[opp].name;
      if (ginHand) {
        scores[seat] = GIN_BONUS + oppDw;
        outcome = `${me} goes GIN! +${scores[seat]}.`;
      } else if (oppDw <= meld.value) {
        scores[opp] = meld.value - oppDw + UNDERCUT_BONUS;
        outcome = `${them} undercuts ${me}! +${scores[opp]}.`;
      } else {
        scores[seat] = oppDw - meld.value;
        outcome = `${me} knocks and scores ${scores[seat]}.`;
      }
      return { ok: true, state: { ...state, hands, stock, discard, over: true, phase: "over", scores, outcome, log: push(log, outcome) } };
    }

    // plain discard → pass turn
    // Stock nearly exhausted with no knock → a wash.
    if (stock.length <= 2) {
      return { ok: true, state: { ...state, hands, stock, discard, over: true, phase: "over", scores: [0, 0], outcome: "Stock ran out — a wash.", log: push(log, "Stock ran out — a wash.") } };
    }
    return { ok: true, state: { ...state, hands, stock, discard, turn: seat === 0 ? 1 : 0, phase: "draw", log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    const meld = seat >= 0 ? bestMelds(state.hands[seat]) : { melds: [], deadwood: [], value: 0 };
    const meldKeys = new Set(meld.melds.flat().map((c) => `${c.r}${c.s}`));
    return {
      type: "gin",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: false,
        extra: { score: state.over ? state.scores[i] : undefined },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        stockCount: state.stock.length,
        discardTop: state.discard[state.discard.length - 1] ?? null,
        phase: state.phase,
        deadwood: meld.value,
        melded: [...meldKeys],
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    if (state.scores[0] === state.scores[1]) return { over: true, winners: [], losers: [], message: state.outcome };
    const w = state.scores[0] > state.scores[1] ? 0 : 1;
    return { over: true, winners: [state.players[w].id], losers: [state.players[w === 0 ? 1 : 0].id], message: state.outcome };
  },
};

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r);
}
