// Hearts - avoid taking hearts (1 pt each) and the Queen of Spades (13). Follow
// suit; you can't lead hearts until they're "broken"; no points on the first
// trick; shooting the moon (all 26) zeroes you and hits everyone else. Single
// hand, lowest score wins.

import { standardDeck, shuffle, type Card } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";
import { followSuit, trickWinner, type PlayedCard } from "./tricks";

interface HeartsState {
  type: "hearts";
  seed: number;
  players: SeatInfo[]; // exactly 4
  hands: Card[][];
  trick: PlayedCard[];
  leader: number;
  turn: number;
  heartsBroken: boolean;
  taken: Card[][];
  trickCount: number;
  over: boolean;
  scores: number[];
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const isQueenSpades = (c: Card) => c.r === 12 && c.s === "S";

function pointsFor(cards: Card[]): number {
  let p = 0;
  for (const c of cards) {
    if (c.s === "H") p += 1;
    if (isQueenSpades(c)) p += 13;
  }
  return p;
}

function finalScores(taken: Card[][]): number[] {
  const raw = taken.map(pointsFor);
  const shooter = raw.findIndex((p) => p === 26);
  if (shooter >= 0) return raw.map((_, i) => (i === shooter ? 0 : 26));
  return raw;
}

export const hearts: GameDefinition<HeartsState> = {
  type: "hearts",
  name: "Hearts",
  blurb: "Dodge every heart and the Queen of Spades - or take them all and shoot the moon.",
  minPlayers: 4,
  maxPlayers: 4,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const hands: Card[][] = [[], [], [], []];
    deck.forEach((c, i) => hands[i % 4].push(c));
    const leader = hands.findIndex((h) => h.some((c) => c.r === 2 && c.s === "C"));
    return {
      type: "hearts",
      seed,
      players: players.slice(0, 4),
      hands,
      trick: [],
      leader,
      turn: leader,
      heartsBroken: false,
      taken: [[], [], [], []],
      trickCount: 0,
      over: false,
      scores: [],
      log: ["Lead the 2♣ to begin."],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    let candidates: Card[];

    if (state.trick.length === 0) {
      // Leading.
      if (state.trickCount === 0) {
        candidates = hand.filter((c) => c.r === 2 && c.s === "C"); // forced 2♣
      } else if (!state.heartsBroken) {
        const nonHearts = hand.filter((c) => c.s !== "H");
        candidates = nonHearts.length > 0 ? nonHearts : hand;
      } else {
        candidates = hand;
      }
    } else {
      // Following.
      candidates = followSuit(hand, state.trick[0].card.s);
      if (state.trickCount === 0) {
        const nonPoints = candidates.filter((c) => c.s !== "H" && !isQueenSpades(c));
        if (nonPoints.length > 0) candidates = nonPoints;
      }
    }
    return candidates.map((card) => ({ type: "play", card }));
  },

  apply(state, actor, action): ApplyResult<HeartsState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    if (action.type !== "play") return { state, ok: false, error: "Unknown action." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const card = action.card as Card | undefined;
    if (!card) return { state, ok: false, error: "No card given." };

    const legal = this.legalActions(state, actor);
    if (!legal.some((a) => (a.card as Card).r === card.r && (a.card as Card).s === card.s))
      return { state, ok: false, error: "You can't play that card." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
    const trick = [...state.trick, { seat, card }];
    let heartsBroken = state.heartsBroken || card.s === "H";
    let log = state.log;
    const taken = state.taken.map((t) => t.slice());
    let leader = state.leader;
    let turn = state.turn;
    let trickCount = state.trickCount;
    let over = false;
    let scores: number[] = state.scores;

    if (trick.length === 4) {
      const winIdx = trickWinner(trick); // no trump in Hearts
      const winner = trick[winIdx].seat;
      taken[winner] = taken[winner].concat(trick.map((p) => p.card));
      trickCount += 1;
      log = push(log, `${state.players[winner].name} takes trick ${trickCount}.`);
      leader = winner;
      turn = winner;
      if (trickCount === 13) {
        over = true;
        scores = finalScores(taken);
        const min = Math.min(...scores);
        const winners = state.players.filter((_, i) => scores[i] === min).map((p) => p.name);
        log = push(log, `Round over - ${winners.join(", ")} win${winners.length > 1 ? "" : "s"} with ${min}.`);
      }
      return { ok: true, state: { ...state, hands, trick: [], heartsBroken, taken, leader, turn, trickCount, over, scores, log } };
    }

    turn = (turn + 1) % 4;
    return { ok: true, state: { ...state, hands, trick, heartsBroken, taken, turn, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "hearts",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: false,
        extra: { points: state.over ? state.scores[i] : pointsFor(state.taken[i]) },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        heartsBroken: state.heartsBroken,
        trickCount: state.trickCount,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const min = Math.min(...state.scores);
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    state.players.forEach((p, i) => (state.scores[i] === min ? winners : losers).push(p.id));
    const parts = state.players.map((p, i) => `${p.name} ${state.scores[i]}`);
    return { over: true, winners, losers, message: `Final: ${parts.join(", ")}.` };
  },
};

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r);
}
