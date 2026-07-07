// Pitch / Auction Setback (4 players) — bid 2–4 for the points you'll take; the
// high bidder ("pitcher") leads, and the suit they lead becomes trump. Four points
// are up for grabs each hand: High, Low, Jack (of trump), and Game (most card
// points). Make your bid or get "set". Single hand, high score wins.

import { standardDeck, shuffle, type Card, type Suit, type Rank } from "../cards";
import { makeRng } from "../rng";
import { nextActiveIndex, type ApplyResult, type GameDefinition, type GameStatus, type GameView, type SeatInfo } from "../types";
import { trickWinner, trickRank, type PlayedCard } from "./tricks";

const HAND = 6;
const gamePts = (r: Rank) => ({ 1: 4, 13: 3, 12: 2, 11: 1, 10: 10 } as Record<number, number>)[r] ?? 0;

interface PitchState {
  type: "pitch";
  seed: number;
  players: SeatInfo[]; // 4
  hands: Card[][];
  phase: "bidding" | "playing" | "over";
  bids: (number | null)[];
  bidTurn: number;
  dealer: number;
  highBid: number;
  pitcher: number;
  trump: Suit | null;
  trick: PlayedCard[];
  turn: number;
  won: Card[][]; // cards each seat has taken in tricks
  trickCount: number;
  scores: number[];
  over: boolean;
  breakdown: string;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const SUIT: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

function tally(state: PitchState, bidAmount: number): { scores: number[]; breakdown: string } {
  const trump = state.trump!;
  const raw = state.players.map(() => 0);
  const parts: string[] = [];
  const ownerOf = (pred: (c: Card) => boolean): number => state.won.findIndex((w) => w.some(pred));

  const trumpCards = state.won.flat().filter((c) => c.s === trump);
  if (trumpCards.length > 0) {
    const high = trumpCards.reduce((a, b) => (trickRank(b.r) > trickRank(a.r) ? b : a));
    const low = trumpCards.reduce((a, b) => (trickRank(b.r) < trickRank(a.r) ? b : a));
    const hi = ownerOf((c) => c.s === trump && c.r === high.r);
    const lo = ownerOf((c) => c.s === trump && c.r === low.r);
    raw[hi] += 1; parts.push(`${state.players[hi].name} High`);
    raw[lo] += 1; parts.push(`${state.players[lo].name} Low`);
    const jk = ownerOf((c) => c.s === trump && c.r === 11);
    if (jk >= 0) { raw[jk] += 1; parts.push(`${state.players[jk].name} Jack`); }
  }
  // Game: most card points (ties award nothing).
  const game = state.won.map((w) => w.reduce((n, c) => n + gamePts(c.r), 0));
  const maxG = Math.max(...game);
  if (maxG > 0 && game.filter((g) => g === maxG).length === 1) {
    const g = game.indexOf(maxG);
    raw[g] += 1; parts.push(`${state.players[g].name} Game`);
  }

  const scores = raw.slice();
  const p = state.pitcher;
  if (raw[p] < bidAmount) {
    scores[p] = -bidAmount; // set: lose the bid
    parts.push(`${state.players[p].name} set (−${bidAmount})`);
  }
  return { scores, breakdown: parts.join(" · ") || "no points" };
}

export const pitch: GameDefinition<PitchState> = {
  type: "pitch",
  name: "Pitch",
  blurb: "Bid for points, then take them. The card you lead first sets trump.",
  minPlayers: 4,
  maxPlayers: 4,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const hands: Card[][] = [[], [], [], []];
    let i = 0;
    for (let k = 0; k < HAND; k++) for (let p = 0; p < 4; p++) hands[p].push(deck[i++]);
    return {
      type: "pitch",
      seed,
      players: players.slice(0, 4),
      hands,
      phase: "bidding",
      bids: [null, null, null, null],
      bidTurn: 0,
      dealer: 3,
      highBid: 0,
      pitcher: -1,
      trump: null,
      trick: [],
      turn: 0,
      won: [[], [], [], []],
      trickCount: 0,
      scores: [],
      over: false,
      breakdown: "",
      log: ["Bid 2–4 for the points you'll take."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (state.phase === "bidding") {
      if (seat !== state.bidTurn) return [];
      const min = state.highBid > 0 ? state.highBid + 1 : 2;
      const bids = [];
      for (let n = min; n <= 4; n++) bids.push({ type: "bid", n });
      // Dealer is stuck if everyone else passed and no bid stands.
      const stuck = seat === state.dealer && state.highBid === 0;
      return stuck ? [{ type: "bid", n: 2 }] : [...bids, { type: "pass" }];
    }
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    // First lead sets trump → any card.
    if (state.trick.length === 0) return hand.map((card) => ({ type: "play", card }));
    // Otherwise follow the led suit — but a player may ALWAYS trump in (Auction
    // Pitch), and if void of the led suit may play anything.
    const led = state.trick[0].card.s;
    const canFollow = hand.filter((c) => c.s === led);
    if (canFollow.length === 0) return hand.map((card) => ({ type: "play", card }));
    const legal = state.trump && state.trump !== led
      ? [...canFollow, ...hand.filter((c) => c.s === state.trump)]
      : canFollow;
    return legal.map((card) => ({ type: "play", card }));
  },

  apply(state, actor, action): ApplyResult<PitchState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);

    if (state.phase === "bidding") {
      if (seat !== state.bidTurn) return { state, ok: false, error: "Not your turn to bid." };
      const legal = this.legalActions(state, actor);
      if (action.type === "bid") {
        const n = action.n as number;
        if (!legal.some((a) => a.type === "bid" && a.n === n)) return { state, ok: false, error: "Bid must beat the current bid." };
        const bids = state.bids.slice();
        bids[seat] = n;
        const log = push(state.log, `${state.players[seat].name} bids ${n}.`);
        const done = state.bidTurn + 1 >= 4;
        const next: PitchState = { ...state, bids, highBid: n, pitcher: seat, bidTurn: state.bidTurn + 1, log };
        return done ? { ok: true, state: startPlay(next) } : { ok: true, state: next };
      }
      if (action.type === "pass") {
        if (!legal.some((a) => a.type === "pass")) return { state, ok: false, error: "You can't pass (stuck)." };
        const log = push(state.log, `${state.players[seat].name} passes.`);
        const done = state.bidTurn + 1 >= 4;
        const next = { ...state, bidTurn: state.bidTurn + 1, log };
        return done ? { ok: true, state: startPlay(next) } : { ok: true, state: next };
      }
      return { state, ok: false, error: "Bid or pass." };
    }

    if (action.type !== "play" || state.phase !== "playing") return { state, ok: false, error: "Play a card." };
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const card = action.card as Card;
    const legal = this.legalActions(state, actor);
    if (!legal.some((a) => (a.card as Card).r === card.r && (a.card as Card).s === card.s))
      return { state, ok: false, error: "You must follow suit." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
    // The pitcher's first lead sets trump.
    let trump = state.trump;
    if (trump === null) trump = card.s;
    const trick = [...state.trick, { seat, card }];
    let log = state.log;
    const won = state.won.map((w) => w.slice());
    let turn = state.turn;
    let trickCount = state.trickCount;

    if (trick.length === 4) {
      const winner = trick[trickWinner(trick, trump)].seat;
      won[winner].push(...trick.map((t) => t.card));
      trickCount += 1;
      turn = winner;
      log = push(log, `${state.players[winner].name} takes trick ${trickCount}.`);
      if (trickCount === HAND) {
        const scored = tally({ ...state, trump, won }, state.highBid);
        return { ok: true, state: { ...state, hands, trump, trick: [], won, trickCount, over: true, scores: scored.scores, breakdown: scored.breakdown, log: push(log, scored.breakdown) } };
      }
      return { ok: true, state: { ...state, hands, trump, trick: [], won, turn, trickCount, log } };
    }
    turn = nextActiveIndex(4, seat, 1, () => false);
    return { ok: true, state: { ...state, hands, trump, trick, turn, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "pitch",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "bidding" ? state.bidTurn === i : state.turn === i),
        out: false,
        extra: { bid: state.pitcher === i ? state.highBid : null, isPitcher: state.pitcher === i, score: state.over ? state.scores[i] : undefined },
      })),
      turn: state.over ? null : state.players[state.phase === "bidding" ? state.bidTurn : state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        trump: state.trump,
        highBid: state.highBid,
        pitcherName: state.pitcher >= 0 ? state.players[state.pitcher].name : null,
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        trickCount: state.trickCount,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const max = Math.max(...state.scores);
    const winners = state.players.filter((_, i) => state.scores[i] === max).map((p) => p.id);
    const losers = state.players.filter((p) => !winners.includes(p.id)).map((p) => p.id);
    const parts = state.players.map((p, i) => `${p.name} ${state.scores[i]}`);
    return { over: true, winners, losers, message: `Final: ${parts.join(", ")}.` };
  },
};

function startPlay(state: PitchState): PitchState {
  // If nobody bid (all passed to a non-stuck dealer path shouldn't happen), pitcher is the dealer at 2.
  const pitcher = state.pitcher >= 0 ? state.pitcher : state.dealer;
  const highBid = state.highBid > 0 ? state.highBid : 2;
  return { ...state, phase: "playing", pitcher, highBid, turn: pitcher, log: push(state.log, `${state.players[pitcher].name} pitches for ${highBid}. Lead sets trump.`) };
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r);
}
