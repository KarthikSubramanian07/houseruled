// Spades - bid the tricks you'll take, then play. Spades are always trump; you
// can't lead them until "broken". Individual scoring: make your bid for 10×bid
// (+1 per overtrick "bag"), miss it for −10×bid; nil is ±100. Single hand, high
// score wins.

import { standardDeck, shuffle, type Card } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";
import { followSuit, trickWinner, type PlayedCard } from "./tricks";

interface SpadesState {
  type: "spades";
  seed: number;
  players: SeatInfo[]; // exactly 4
  hands: Card[][];
  phase: "bidding" | "playing" | "over";
  bids: (number | null)[];
  bidTurn: number;
  trick: PlayedCard[];
  leader: number;
  turn: number;
  spadesBroken: boolean;
  tricksWon: number[];
  trickCount: number;
  scores: number[];
  over: boolean;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

function score(bid: number, won: number): number {
  if (bid === 0) return won === 0 ? 100 : -100; // nil
  if (won >= bid) return bid * 10 + (won - bid); // made + bags
  return -bid * 10; // set
}

export const spades: GameDefinition<SpadesState> = {
  type: "spades",
  name: "Spades",
  blurb: "Bid the tricks you'll win, then take them. Spades trump everything.",
  minPlayers: 4,
  maxPlayers: 4,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const hands: Card[][] = [[], [], [], []];
    deck.forEach((c, i) => hands[i % 4].push(c));
    return {
      type: "spades",
      seed,
      players: players.slice(0, 4),
      hands,
      phase: "bidding",
      bids: [null, null, null, null],
      bidTurn: 0,
      trick: [],
      leader: 0,
      turn: 0,
      spadesBroken: false,
      tricksWon: [0, 0, 0, 0],
      trickCount: 0,
      scores: [],
      over: false,
      log: ["Place your bids."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (state.phase === "bidding") {
      if (seat !== state.bidTurn) return [];
      return Array.from({ length: 14 }, (_, n) => ({ type: "bid", n }));
    }
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    let candidates: Card[];
    if (state.trick.length === 0) {
      if (!state.spadesBroken) {
        const nonSpades = hand.filter((c) => c.s !== "S");
        candidates = nonSpades.length > 0 ? nonSpades : hand;
      } else {
        candidates = hand;
      }
    } else {
      candidates = followSuit(hand, state.trick[0].card.s);
    }
    return candidates.map((card) => ({ type: "play", card }));
  },

  apply(state, actor, action): ApplyResult<SpadesState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);

    if (action.type === "bid") {
      if (state.phase !== "bidding") return { state, ok: false, error: "Bidding is over." };
      if (seat !== state.bidTurn) return { state, ok: false, error: "Not your turn to bid." };
      const n = action.n as number;
      if (typeof n !== "number" || n < 0 || n > 13) return { state, ok: false, error: "Bid 0–13." };
      const bids = state.bids.slice();
      bids[seat] = n;
      let log = push(state.log, `${state.players[seat].name} bids ${n === 0 ? "nil" : n}.`);
      const nextBidder = state.bidTurn + 1;
      if (nextBidder >= 4) {
        log = push(log, "Bidding done - lead off.");
        return { ok: true, state: { ...state, bids, phase: "playing", turn: state.leader, log } };
      }
      return { ok: true, state: { ...state, bids, bidTurn: nextBidder, log } };
    }

    if (action.type !== "play") return { state, ok: false, error: "Unknown action." };
    if (state.phase !== "playing") return { state, ok: false, error: "Not the play phase." };
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const card = action.card as Card | undefined;
    if (!card) return { state, ok: false, error: "No card given." };
    const legal = this.legalActions(state, actor);
    if (!legal.some((a) => (a.card as Card).r === card.r && (a.card as Card).s === card.s))
      return { state, ok: false, error: "You can't play that card." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
    const trick = [...state.trick, { seat, card }];
    const spadesBroken = state.spadesBroken || card.s === "S";
    let log = state.log;
    const tricksWon = state.tricksWon.slice();
    let leader = state.leader;
    let turn = state.turn;
    let trickCount = state.trickCount;
    let over = false;
    let scores = state.scores;

    if (trick.length === 4) {
      const winner = trick[trickWinner(trick, "S")].seat;
      tricksWon[winner] += 1;
      trickCount += 1;
      log = push(log, `${state.players[winner].name} wins trick ${trickCount}.`);
      leader = winner;
      turn = winner;
      if (trickCount === 13) {
        over = true;
        scores = state.players.map((_, i) => score(state.bids[i] ?? 0, tricksWon[i]));
        const max = Math.max(...scores);
        const w = state.players.filter((_, i) => scores[i] === max).map((p) => p.name);
        log = push(log, `Hand over - ${w.join(", ")} win${w.length > 1 ? "" : "s"}.`);
      }
      return { ok: true, state: { ...state, hands, trick: [], spadesBroken, tricksWon, leader, turn, trickCount, over, scores, log } };
    }

    turn = (turn + 1) % 4;
    return { ok: true, state: { ...state, hands, trick, spadesBroken, turn, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "spades",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "bidding" ? state.bidTurn === i : state.turn === i),
        out: false,
        extra: {
          bid: state.bids[i],
          won: state.tricksWon[i],
          score: state.over ? state.scores[i] : undefined,
        },
      })),
      turn: state.over ? null : state.players[state.phase === "bidding" ? state.bidTurn : state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        spadesBroken: state.spadesBroken,
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
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    state.players.forEach((p, i) => (state.scores[i] === max ? winners : losers).push(p.id));
    const parts = state.players.map((p, i) => `${p.name} ${state.scores[i]}`);
    return { over: true, winners, losers, message: `Final: ${parts.join(", ")}.` };
  },
};

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r);
}
