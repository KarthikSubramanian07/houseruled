// Cheat (Bluff), a.k.a. "I Doubt It" - play cards face-down claiming the current
// rank; the next player can call your bluff. Wrong caller eats the pile; a caught
// liar eats the pile. First to empty their hand (uncaught) wins.
//
// Simplification: only the player whose turn it is may call the previous claim
// (a common digital variant), which keeps it cleanly turn-based.

import { standardDeck, shuffle, type Card, type Rank, RANK_LABEL } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";

const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

interface Claim {
  seat: number;
  rank: Rank;
  count: number;
}

interface CheatState {
  type: "cheat";
  seed: number;
  players: SeatInfo[];
  hands: Card[][];
  pile: Card[]; // face-down; only counts + last claim are public
  claim: Claim | null;
  rankIdx: number; // required rank cycles A,2,…,K
  turn: number;
  winnerPending: number; // a seat that emptied its hand and awaits a possible call
  over: boolean;
  winner: number | null;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const cardKey = (c: Card) => `${c.r}${c.s}`;

export const cheat: GameDefinition<CheatState> = {
  type: "cheat",
  name: "Cheat (Bluff)",
  blurb: "Play cards face-down and claim the rank - lie if you must. Get caught and eat the pile.",
  minPlayers: 2,
  maxPlayers: 6,

  init(players, _rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const hands: Card[][] = players.map(() => []);
    deck.forEach((c, i) => hands[i % players.length].push(c));
    return {
      type: "cheat",
      seed,
      players,
      hands,
      pile: [],
      claim: null,
      rankIdx: 0,
      turn: 0,
      winnerPending: -1,
      over: false,
      winner: null,
      log: [`Play your ${RANK_LABEL[1]}s (or bluff).`],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const actions: { type: string }[] = [];
    // The client selects which 1–4 cards to play as the required rank.
    if (state.hands[seat].length > 0) actions.push({ type: "play" });
    if (state.claim) actions.push({ type: "call" });
    return actions;
  },

  apply(state, actor, action): ApplyResult<CheatState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };

    if (action.type === "play") {
      // Choosing to play instead of calling concedes a pending winner.
      if (state.winnerPending >= 0) {
        return { ok: true, state: winBy(state, state.winnerPending, "nobody doubted") };
      }
      const cards = (action.cards as Card[]) ?? [];
      if (cards.length < 1 || cards.length > 4) return { state, ok: false, error: "Play 1–4 cards." };
      const hand = state.hands[seat];
      const keys = new Set(hand.map(cardKey));
      if (!cards.every((c) => keys.has(cardKey(c)))) return { state, ok: false, error: "You don't hold those cards." };
      // (Duplicates in the submitted set are guarded by removing exact matches.)

      const hands = state.hands.map((h) => h.slice());
      for (const c of cards) {
        const idx = hands[seat].findIndex((x) => x.r === c.r && x.s === c.s);
        if (idx < 0) return { state, ok: false, error: "You don't hold those cards." };
        hands[seat].splice(idx, 1);
      }
      const rank = RANKS[state.rankIdx];
      const pile = state.pile.concat(cards);
      const claim: Claim = { seat, rank, count: cards.length };
      const rankIdx = (state.rankIdx + 1) % 13;
      const winnerPending = hands[seat].length === 0 ? seat : -1;
      const turn = (state.turn + 1) % state.players.length;
      const log = push(state.log, `${state.players[seat].name} plays ${cards.length} × ${RANK_LABEL[rank]}.`);
      return { ok: true, state: { ...state, hands, pile, claim, rankIdx, turn, winnerPending, log } };
    }

    if (action.type === "call") {
      if (!state.claim) return { state, ok: false, error: "Nothing to call." };
      const claim = state.claim;
      const claimed = state.pile.slice(state.pile.length - claim.count);
      const truthful = claimed.every((c) => c.r === claim.rank);
      const hands = state.hands.map((h) => h.slice());
      let log = state.log;
      const claimerName = state.players[claim.seat].name;
      const callerName = state.players[seat].name;

      if (truthful) {
        // Caller was wrong.
        if (state.winnerPending === claim.seat) {
          return { ok: true, state: winBy(state, claim.seat, `${callerName} doubted an honest play`) };
        }
        hands[seat] = hands[seat].concat(state.pile);
        log = push(log, `${callerName} doubted - but ${claimerName} was honest! ${callerName} takes ${state.pile.length}.`);
        return { ok: true, state: { ...state, hands, pile: [], claim: null, winnerPending: -1, turn: claim.seat, log } };
      }
      // Claimer lied.
      hands[claim.seat] = hands[claim.seat].concat(state.pile);
      log = push(log, `${callerName} caught ${claimerName} bluffing! ${claimerName} takes ${state.pile.length}.`);
      return { ok: true, state: { ...state, hands, pile: [], claim: null, winnerPending: -1, turn: seat, log } };
    }

    return { state, ok: false, error: "Unknown action." };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "cheat",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: false,
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        pileCount: state.pile.length,
        requiredRank: RANK_LABEL[RANKS[state.rankIdx]],
        claim: state.claim ? { name: state.players[state.claim.seat].name, rank: RANK_LABEL[state.claim.rank], count: state.claim.count } : null,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over || state.winner === null) return { over: false, winners: [], losers: [] };
    const w = state.players[state.winner];
    return { over: true, winners: [w.id], losers: state.players.filter((_, i) => i !== state.winner).map((p) => p.id), message: `${w.name} wins!` };
  },
};

function winBy(state: CheatState, seat: number, why: string): CheatState {
  return { ...state, over: true, winner: seat, log: push(state.log, `${state.players[seat].name} is out - ${why}!`) };
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
}
