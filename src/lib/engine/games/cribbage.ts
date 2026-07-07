// Cribbage (2 players) — the classic 121-point race. Deal 6, discard 2 to the
// dealer's crib, cut a starter, then peg through "the play" (15s, pairs, runs,
// 31, go) before scoring "the show" (15s, pairs, runs, flush, nobs) for each
// hand and the crib. First to 121 wins — pone counts before the dealer, so the
// last few points are a genuine race.

import { standardDeck, shuffle, type Card, type Rank } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, SeatInfo } from "../types";

const WIN = 121;
const key = (c: Card) => `${c.r}${c.s}`;
const other = (i: number) => (i === 0 ? 1 : 0);
/** Pip value for 15/31 counting: face cards = 10, Ace = 1. */
const cnt = (r: Rank) => (r >= 10 ? 10 : r);

interface CribState {
  type: "cribbage";
  seed: number;
  deal: number;
  players: SeatInfo[]; // 2
  dealer: number;
  hands: Card[][]; // live cards (6 → 4 after discard, shrinks during the play)
  kept: Card[][]; // the 4 cards kept, frozen for the show
  crib: Card[];
  deckRest: Card[]; // undealt stock; the cut comes off the top
  discarded: [boolean, boolean];
  starter: Card | null;
  phase: "discard" | "play" | "over";
  count: number; // running pegging count (0–31)
  playPile: { seat: number; card: Card }[]; // cards since the last reset
  goBy: number | null; // seat currently holding a "go"
  lastPlayer: number;
  turn: number;
  scores: [number, number];
  over: boolean;
  winner: number | null;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-12);
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/** Points from the card just played (last in `pile`), given the new running count. */
export function pegScore(pile: { seat: number; card: Card }[], count: number): { pts: number; notes: string[] } {
  const notes: string[] = [];
  let pts = 0;
  if (count === 15) { pts += 2; notes.push("15 for 2"); }
  if (count === 31) { pts += 2; notes.push("31 for 2"); }
  const last = pile[pile.length - 1].card;
  let k = 0;
  for (let i = pile.length - 1; i >= 0; i--) { if (pile[i].card.r === last.r) k++; else break; }
  if (k >= 2) { pts += k * (k - 1); notes.push(k === 2 ? "pair" : k === 3 ? "pair royal" : "double pair royal"); }
  for (let L = pile.length; L >= 3; L--) {
    const seg = pile.slice(pile.length - L).map((p) => p.card.r);
    const set = new Set(seg);
    if (set.size === L && Math.max(...seg) - Math.min(...seg) === L - 1) { pts += L; notes.push(`run of ${L}`); break; }
  }
  return { pts, notes };
}

/** Score a 4-card hand (or crib) with the starter for the show. */
export function showScore(four: Card[], starter: Card, isCrib: boolean): { pts: number; notes: string[] } {
  const cards = [...four, starter];
  const notes: string[] = [];
  let pts = 0;

  let fifteens = 0;
  for (let m = 1; m < 32; m++) {
    let sum = 0;
    for (let i = 0; i < 5; i++) if (m & (1 << i)) sum += cnt(cards[i].r);
    if (sum === 15) fifteens++;
  }
  if (fifteens) { pts += fifteens * 2; notes.push(`${fifteens}×15`); }

  const rc: Record<number, number> = {};
  for (const c of cards) rc[c.r] = (rc[c.r] ?? 0) + 1;
  let pairs = 0;
  for (const r in rc) pairs += rc[r] * (rc[r] - 1);
  if (pairs) { pts += pairs; notes.push(`${pairs / 2} pair${pairs / 2 > 1 ? "s" : ""}`); }

  let runPts = 0;
  for (let r = 1; r <= 13; ) {
    if (!rc[r]) { r++; continue; }
    let end = r;
    while (rc[end + 1]) end++;
    const len = end - r + 1;
    if (len >= 3) {
      let prod = 1;
      for (let x = r; x <= end; x++) prod *= rc[x];
      runPts += len * prod;
    }
    r = end + 1;
  }
  if (runPts) { pts += runPts; notes.push(`runs ${runPts}`); }

  const suit = four[0].s;
  if (four.every((c) => c.s === suit)) {
    if (starter.s === suit) { pts += 5; notes.push("flush 5"); }
    else if (!isCrib) { pts += 4; notes.push("flush 4"); }
  }
  if (four.some((c) => c.r === 11 && c.s === starter.s)) { pts += 1; notes.push("nobs"); }

  return { pts, notes };
}

// ── State transitions ─────────────────────────────────────────────────────────

function dealHands(s: CribState, dealer: number): CribState {
  const deck = shuffle(standardDeck(), makeRng(s.seed + s.deal * 131 + 7));
  return {
    ...s,
    dealer,
    hands: [deck.slice(0, 6), deck.slice(6, 12)],
    kept: [[], []],
    crib: [],
    deckRest: deck.slice(12),
    discarded: [false, false],
    starter: null,
    phase: "discard",
    count: 0,
    playPile: [],
    goBy: null,
    turn: other(dealer),
    lastPlayer: other(dealer),
    log: push(s.log, `Deal ${s.deal + 1} — ${s.players[dealer].name} deals. Each discards 2 to the crib.`),
  };
}

/** Add pegging/show points; clamp at 121 and end the game the instant it's reached. */
function award(s: CribState, seat: number, pts: number, label: string): CribState {
  if (pts <= 0) return s;
  const scores: [number, number] = [s.scores[0], s.scores[1]];
  scores[seat] += pts;
  const log = push(s.log, `${s.players[seat].name} +${pts} — ${label}.`);
  if (scores[seat] >= WIN) {
    return { ...s, scores: [Math.min(scores[0], WIN), Math.min(scores[1], WIN)] as [number, number], over: true, phase: "over", winner: seat, log: push(log, `${s.players[seat].name} reaches 121 — game!`) };
  }
  return { ...s, scores, log };
}

/** Score the show (pone, then dealer's hand, then dealer's crib) and start the next deal. */
function doShow(s: CribState): CribState {
  const starter = s.starter!;
  const pone = other(s.dealer);
  let st = s;
  const order: [number, Card[], boolean, string][] = [
    [pone, s.kept[pone], false, "hand"],
    [s.dealer, s.kept[s.dealer], false, "hand"],
    [s.dealer, s.crib, true, "crib"],
  ];
  for (const [seat, cards, isCrib, label] of order) {
    const sc = showScore(cards, starter, isCrib);
    st = award(st, seat, sc.pts, `${label} (${sc.notes.join(", ") || "0"})`);
    if (st.over) return st;
  }
  return dealHands({ ...st, deal: s.deal + 1 }, other(s.dealer));
}

/** Advance the play, auto-resolving forced "go"s so a player is only ever asked for a real card. */
function autoGo(s: CribState): CribState {
  let st = s;
  for (let guard = 0; guard < 40; guard++) {
    const t = st.turn;
    const playable = st.hands[t].some((c) => cnt(c.r) + st.count <= 31);
    if (playable) return st; // this player has a legal card — wait for them
    // Forced go.
    if (st.goBy !== null && st.goBy !== t) {
      st = award(st, st.lastPlayer, 1, "go");
      if (st.over) return st;
      st = { ...st, count: 0, playPile: [], goBy: null, turn: other(st.lastPlayer) };
      if (st.hands[0].length === 0 && st.hands[1].length === 0) return doShow(st);
    } else {
      st = { ...st, goBy: t, turn: other(t) };
    }
  }
  return st;
}

function resolvePlay(s: CribState, seat: number, closed31: boolean): CribState {
  if (s.hands[0].length === 0 && s.hands[1].length === 0) {
    let st = s;
    if (!closed31) { st = award(st, seat, 1, "last card"); if (st.over) return st; }
    return doShow(st);
  }
  const st = closed31
    ? { ...s, count: 0, playPile: [], goBy: null, turn: other(seat) }
    : { ...s, turn: other(seat) };
  return autoGo(st);
}

function beginPlay(s: CribState): CribState {
  const starter = s.deckRest[0];
  let st: CribState = { ...s, phase: "play", count: 0, playPile: [], goBy: null, starter, turn: other(s.dealer), lastPlayer: other(s.dealer), log: push(s.log, `Starter is ${key(starter)}. ${s.players[other(s.dealer)].name} leads the play.`) };
  if (starter.r === 11) { st = award(st, s.dealer, 2, "his heels"); if (st.over) return st; }
  return autoGo(st);
}

// ── Definition ──────────────────────────────────────────────────────────────

export const cribbage: GameDefinition<CribState> = {
  type: "cribbage",
  name: "Cribbage",
  blurb: "Discard to the crib, peg through the play, then count 15s, pairs, runs and nobs to 121.",
  minPlayers: 2,
  maxPlayers: 2,

  init(players, _rules, seed) {
    const base: CribState = {
      type: "cribbage",
      seed,
      deal: 0,
      players: players.slice(0, 2),
      dealer: 1,
      hands: [[], []],
      kept: [[], []],
      crib: [],
      deckRest: [],
      discarded: [false, false],
      starter: null,
      phase: "discard",
      count: 0,
      playPile: [],
      goBy: null,
      lastPlayer: 0,
      turn: 0,
      scores: [0, 0],
      over: false,
      winner: null,
      log: ["Discard 2 cards to the crib."],
    };
    return dealHands(base, 1);
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat < 0) return [];
    if (state.phase === "discard") {
      if (state.discarded[seat]) return [];
      const h = state.hands[seat];
      const combos: { type: string; cards: Card[] }[] = [];
      for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) combos.push({ type: "discard", cards: [h[i], h[j]] });
      return combos;
    }
    if (state.phase === "play") {
      if (seat !== state.turn) return [];
      return state.hands[seat].filter((c) => cnt(c.r) + state.count <= 31).map((card) => ({ type: "play", card }));
    }
    return [];
  },

  apply(state, actor, action): ApplyResult<CribState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat < 0) return { state, ok: false, error: "Not a player." };

    if (state.phase === "discard") {
      if (action.type !== "discard") return { state, ok: false, error: "Discard 2 to the crib." };
      if (state.discarded[seat]) return { state, ok: false, error: "You've already discarded." };
      const cards = action.cards as Card[];
      if (!Array.isArray(cards) || cards.length !== 2 || key(cards[0]) === key(cards[1])) return { state, ok: false, error: "Choose exactly 2 cards." };
      if (!cards.every((c) => state.hands[seat].some((h) => key(h) === key(c)))) return { state, ok: false, error: "You don't hold those." };
      const takeKeys = new Set(cards.map(key));
      const hands = state.hands.map((h) => h.slice());
      hands[seat] = hands[seat].filter((c) => !takeKeys.has(key(c)));
      const kept = state.kept.map((h) => h.slice());
      kept[seat] = hands[seat].slice();
      const crib = [...state.crib, ...cards];
      const discarded: [boolean, boolean] = [state.discarded[0], state.discarded[1]];
      discarded[seat] = true;
      const log = push(state.log, `${state.players[seat].name} lays 2 to the crib.`);
      const next: CribState = { ...state, hands, kept, crib, discarded, log };
      if (discarded[0] && discarded[1]) return { ok: true, state: beginPlay(next) };
      return { ok: true, state: next };
    }

    if (state.phase === "play") {
      if (action.type !== "play") return { state, ok: false, error: "Play a card." };
      if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
      const card = action.card as Card;
      if (!state.hands[seat].some((c) => key(c) === key(card))) return { state, ok: false, error: "You don't hold that." };
      if (cnt(card.r) + state.count > 31) return { state, ok: false, error: "That would take the count past 31." };

      const hands = state.hands.map((h) => h.slice());
      hands[seat] = hands[seat].filter((c) => key(c) !== key(card));
      const count = state.count + cnt(card.r);
      const playPile = [...state.playPile, { seat, card }];
      const { pts, notes } = pegScore(playPile, count);
      let st: CribState = { ...state, hands, count, playPile, goBy: null, lastPlayer: seat, log: push(state.log, `${state.players[seat].name} plays ${key(card)} (count ${count}).`) };
      if (pts > 0) { st = award(st, seat, pts, notes.join(" + ")); if (st.over) return { ok: true, state: st }; }
      return { ok: true, state: resolvePlay(st, seat, count === 31) };
    }

    return { state, ok: false, error: "Nothing to do." };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "cribbage",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "discard" ? !state.discarded[i] : state.turn === i),
        out: false,
        extra: { score: state.scores[i], isDealer: state.dealer === i, discarded: state.discarded[i] },
      })),
      turn: state.over ? null : state.phase === "discard" ? null : state.players[state.turn].id,
      hand: seat >= 0 ? [...state.hands[seat]].sort((a, b) => a.r - b.r || a.s.localeCompare(b.s)) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        starter: state.starter,
        count: state.count,
        cribSize: state.crib.length,
        isDealer: seat === state.dealer,
        pile: state.playPile.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        scores: state.scores,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over || state.winner == null) return { over: false, winners: [], losers: [] };
    const w = state.winner;
    return { over: true, winners: [state.players[w].id], losers: [state.players[other(w)].id], message: `${state.players[w].name} wins ${state.scores[w]}–${state.scores[other(w)]}.` };
  },
};
