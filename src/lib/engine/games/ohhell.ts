// Oh Hell — bid the EXACT number of tricks you'll take. Make it exactly for
// 10 + your bid; miss by any amount and you lose points. A turned card sets
// trump; the dealer's bid is constrained so the bids can't sum to the hand size
// ("screw the dealer"). Single hand of 8 tricks.

import { standardDeck, shuffle, type Card, type Suit } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";
import { followSuit, trickWinner, type PlayedCard } from "./tricks";

const HAND = 8;

interface OhHellState {
  type: "ohhell";
  seed: number;
  players: SeatInfo[];
  hands: Card[][];
  trump: Suit;
  turned: Card;
  dealer: number;
  phase: "bidding" | "playing" | "over";
  bids: (number | null)[];
  bidTurn: number;
  trick: PlayedCard[];
  leader: number;
  turn: number;
  trumpBroken: boolean;
  tricksWon: number[];
  trickCount: number;
  scores: number[];
  over: boolean;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const SUIT: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export const ohhell: GameDefinition<OhHellState> = {
  type: "ohhell",
  name: "Oh Hell",
  blurb: "Bid the exact tricks you'll take — no more, no less. Trump is turned each hand.",
  minPlayers: 3,
  maxPlayers: 6,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const n = players.length;
    const hands: Card[][] = players.map(() => []);
    let i = 0;
    for (let k = 0; k < HAND; k++) for (let p = 0; p < n; p++) hands[p].push(deck[i++]);
    const turned = deck[i];
    const dealer = n - 1; // left of dealer (seat 0) bids + leads first
    return {
      type: "ohhell",
      seed,
      players,
      hands,
      trump: turned.s,
      turned,
      dealer,
      phase: "bidding",
      bids: players.map(() => null),
      bidTurn: 0,
      trick: [],
      leader: 0,
      turn: 0,
      trumpBroken: false,
      tricksWon: players.map(() => 0),
      trickCount: 0,
      scores: [],
      over: false,
      log: [`Trump is ${SUIT[turned.s]}. Bid your exact tricks.`],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (state.phase === "bidding") {
      if (seat !== state.bidTurn) return [];
      let bids = Array.from({ length: HAND + 1 }, (_, n) => n);
      // Screw the dealer: their bid can't make the total equal the hand size.
      if (seat === state.dealer) {
        const others = state.bids.reduce((sum: number, b, i) => (i === seat ? sum : sum + (b ?? 0)), 0);
        const forbidden = HAND - others;
        if (forbidden >= 0 && forbidden <= HAND) bids = bids.filter((b) => b !== forbidden);
      }
      return bids.map((n) => ({ type: "bid", n }));
    }
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    let cards: Card[];
    if (state.trick.length === 0) {
      if (!state.trumpBroken) {
        const nonTrump = hand.filter((c) => c.s !== state.trump);
        cards = nonTrump.length > 0 ? nonTrump : hand;
      } else cards = hand;
    } else {
      cards = followSuit(hand, state.trick[0].card.s);
    }
    return cards.map((card) => ({ type: "play", card }));
  },

  apply(state, actor, action): ApplyResult<OhHellState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);

    if (action.type === "bid") {
      if (state.phase !== "bidding") return { state, ok: false, error: "Bidding is over." };
      if (seat !== state.bidTurn) return { state, ok: false, error: "Not your turn to bid." };
      const legal = this.legalActions(state, actor);
      const n = action.n as number;
      if (!legal.some((a) => a.n === n)) return { state, ok: false, error: "That bid isn't allowed." };
      const bids = state.bids.slice();
      bids[seat] = n;
      let log = push(state.log, `${state.players[seat].name} bids ${n}.`);
      if (state.bidTurn + 1 >= state.players.length) {
        log = push(log, "Bids in — lead off.");
        return { ok: true, state: { ...state, bids, phase: "playing", turn: state.leader, log } };
      }
      return { ok: true, state: { ...state, bids, bidTurn: state.bidTurn + 1, log } };
    }

    if (action.type !== "play" || state.phase !== "playing") return { state, ok: false, error: "Play a card." };
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    const card = action.card as Card;
    const legal = this.legalActions(state, actor);
    if (!legal.some((a) => (a.card as Card).r === card.r && (a.card as Card).s === card.s))
      return { state, ok: false, error: "You must follow suit." };

    const hands = state.hands.map((h) => h.slice());
    hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
    const trick = [...state.trick, { seat, card }];
    const trumpBroken = state.trumpBroken || card.s === state.trump;
    let log = state.log;
    const tricksWon = state.tricksWon.slice();
    let leader = state.leader;
    let turn = state.turn;
    let trickCount = state.trickCount;

    if (trick.length === state.players.length) {
      const winner = trick[trickWinner(trick, state.trump)].seat;
      tricksWon[winner] += 1;
      trickCount += 1;
      leader = winner;
      turn = winner;
      log = push(log, `${state.players[winner].name} takes trick ${trickCount}.`);
      if (trickCount === HAND) {
        const scores = state.players.map((_, i) => (tricksWon[i] === (state.bids[i] ?? 0) ? 10 + tricksWon[i] : -Math.abs(tricksWon[i] - (state.bids[i] ?? 0))));
        const max = Math.max(...scores);
        const w = state.players.filter((_, i) => scores[i] === max).map((p) => p.name);
        return { ok: true, state: { ...state, hands, trick: [], trumpBroken, tricksWon, trickCount, over: true, scores, log: push(log, `Hand over — ${w.join(", ")} win${w.length > 1 ? "" : "s"}.`) } };
      }
      return { ok: true, state: { ...state, hands, trick: [], trumpBroken, tricksWon, leader, turn, trickCount, log } };
    }
    turn = (turn + 1) % state.players.length;
    return { ok: true, state: { ...state, hands, trick, trumpBroken, turn, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "ohhell",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "bidding" ? state.bidTurn === i : state.turn === i),
        out: false,
        extra: { bid: state.bids[i], won: state.tricksWon[i], score: state.over ? state.scores[i] : undefined },
      })),
      turn: state.over ? null : state.players[state.phase === "bidding" ? state.bidTurn : state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        trump: state.trump,
        turned: state.turned,
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        trickCount: state.trickCount,
        handSize: HAND,
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
