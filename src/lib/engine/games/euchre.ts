// Euchre — 4 players in fixed partnerships (0&2 vs 1&3), a 24-card deck (9–A),
// trump chosen by bidding on a turned-up card, and the bower twist: the Jack of
// trump (right bower) and the Jack of trump's same-color suit (left bower) are the
// two highest trumps, and the left bower counts as the trump suit. Single hand:
// makers score 1 (2 for all five = a march); defenders score 2 for a euchre.
//
// v1 omits "going alone" (all four always play) — noted for a later pass.

import { standardDeck, shuffle, type Card, type Suit } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";
import type { PlayedCard } from "./tricks";

interface EuchreState {
  type: "euchre";
  seed: number;
  players: SeatInfo[]; // 4
  hands: Card[][];
  kitty: Card[]; // 3 down + the turned card
  turned: Card;
  dealer: number; // seat 3 → left-of-dealer (seat 0) acts first
  phase: "bid1" | "bid2" | "discard" | "playing" | "over";
  bidTurn: number;
  trump: Suit | null;
  maker: number | null; // seat that named trump; team = maker % 2
  trick: PlayedCard[];
  leader: number;
  turn: number;
  tricksWon: [number, number]; // by team
  trickCount: number;
  scores: [number, number];
  over: boolean;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

const EUCHRE_RANKS = new Set([9, 10, 11, 12, 13, 1]);
function euchreDeck(): Card[] {
  return standardDeck().filter((c) => EUCHRE_RANKS.has(c.r));
}

const SAME_COLOR: Record<Suit, Suit> = { S: "C", C: "S", H: "D", D: "H" };
const isRightBower = (c: Card, t: Suit) => c.r === 11 && c.s === t;
const isLeftBower = (c: Card, t: Suit) => c.r === 11 && c.s === SAME_COLOR[t];
/** The suit a card behaves as (left bower behaves as trump). */
function effectiveSuit(c: Card, t: Suit): Suit {
  return isLeftBower(c, t) ? t : c.s;
}
const isTrump = (c: Card, t: Suit) => effectiveSuit(c, t) === t;

/** Strength of a card for winning a trick, given trump + the led (effective) suit. */
function strength(c: Card, trump: Suit, led: Suit): number {
  if (isRightBower(c, trump)) return 100;
  if (isLeftBower(c, trump)) return 99;
  if (isTrump(c, trump)) return (({ 1: 20, 13: 19, 12: 18, 10: 17, 9: 16 }) as Record<number, number>)[c.r] ?? 15;
  if (c.s === led) return (({ 1: 10, 13: 9, 12: 8, 11: 7, 10: 6, 9: 5 }) as Record<number, number>)[c.r] ?? 0;
  return 0; // off-suit, can't win
}

function trickWinnerEuchre(played: PlayedCard[], trump: Suit): number {
  const led = effectiveSuit(played[0].card, trump);
  let best = 0;
  for (let i = 1; i < played.length; i++) {
    if (strength(played[i].card, trump, led) > strength(played[best].card, trump, led)) best = i;
  }
  return best;
}

/** Cards that legally follow the led (effective) suit; else the whole hand. */
function legalFollow(hand: Card[], led: Suit, trump: Suit): Card[] {
  const inSuit = hand.filter((c) => effectiveSuit(c, trump) === led);
  return inSuit.length > 0 ? inSuit : hand.slice();
}

const team = (seat: number) => seat % 2;

export const euchre: GameDefinition<EuchreState> = {
  type: "euchre",
  name: "Euchre",
  blurb: "Partners, a 24-card deck, and bowers. Name trump, take three of five tricks.",
  minPlayers: 4,
  maxPlayers: 4,

  init(players, _rules, seed) {
    const deck = shuffle(euchreDeck(), makeRng(seed));
    const hands: Card[][] = [[], [], [], []];
    let i = 0;
    for (let n = 0; n < 5; n++) for (let p = 0; p < 4; p++) hands[p].push(deck[i++]);
    const kitty = deck.slice(i); // 4 cards
    return {
      type: "euchre",
      seed,
      players: players.slice(0, 4),
      hands,
      kitty,
      turned: kitty[0],
      dealer: 3,
      phase: "bid1",
      bidTurn: 0,
      trump: null,
      maker: null,
      trick: [],
      leader: 0,
      turn: 0,
      tricksWon: [0, 0],
      trickCount: 0,
      scores: [0, 0],
      over: false,
      log: [`Up-card: ${cardStr(kitty[0])}. Order it up or pass.`],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);

    if (state.phase === "bid1") {
      if (seat !== state.bidTurn) return [];
      return [{ type: "orderup" }, { type: "pass" }];
    }
    if (state.phase === "bid2") {
      if (seat !== state.bidTurn) return [];
      const suits = (["S", "H", "D", "C"] as Suit[]).filter((s) => s !== state.turned.s);
      const calls = suits.map((suit) => ({ type: "call", suit }));
      // Stick the dealer: if the dealer is on and everyone passed, they must call.
      return state.bidTurn === state.dealer ? calls : [...calls, { type: "pass" }];
    }
    if (state.phase === "discard") {
      if (seat !== state.dealer) return [];
      return state.hands[seat].map((card) => ({ type: "discard", card }));
    }
    if (state.phase === "playing") {
      if (seat !== state.turn || !state.trump) return [];
      const hand = state.hands[seat];
      const cards =
        state.trick.length === 0
          ? hand
          : legalFollow(hand, effectiveSuit(state.trick[0].card, state.trump), state.trump);
      return cards.map((card) => ({ type: "play", card }));
    }
    return [];
  },

  apply(state, actor, action): ApplyResult<EuchreState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);

    // ── Bidding round 1 ──
    if (state.phase === "bid1") {
      if (seat !== state.bidTurn) return { state, ok: false, error: "Not your turn to bid." };
      if (action.type === "orderup") {
        const trump = state.turned.s;
        const hands = state.hands.map((h) => h.slice());
        hands[state.dealer] = hands[state.dealer].concat(state.turned); // dealer picks it up
        return {
          ok: true,
          state: {
            ...state,
            trump,
            maker: seat,
            hands,
            phase: "discard",
            log: push(state.log, `${state.players[seat].name} orders up ${SUIT[trump]}. Dealer discards.`),
          },
        };
      }
      if (action.type === "pass") {
        const next = state.bidTurn + 1;
        if (next > 3) return { ok: true, state: { ...state, phase: "bid2", bidTurn: 0, log: push(state.log, "All passed. Name a different suit.") } };
        return { ok: true, state: { ...state, bidTurn: next } };
      }
      return { state, ok: false, error: "Unknown action." };
    }

    // ── Bidding round 2 ──
    if (state.phase === "bid2") {
      if (seat !== state.bidTurn) return { state, ok: false, error: "Not your turn to bid." };
      if (action.type === "call") {
        const suit = action.suit as Suit;
        if (suit === state.turned.s || !["S", "H", "D", "C"].includes(suit))
          return { state, ok: false, error: "Pick a different suit." };
        return {
          ok: true,
          state: { ...state, trump: suit, maker: seat, phase: "playing", turn: state.leader, log: push(state.log, `${state.players[seat].name} calls ${SUIT[suit]}.`) },
        };
      }
      if (action.type === "pass") {
        if (state.bidTurn === state.dealer) return { state, ok: false, error: "Dealer must name a suit (stuck)." };
        return { ok: true, state: { ...state, bidTurn: state.bidTurn + 1 } };
      }
      return { state, ok: false, error: "Unknown action." };
    }

    // ── Dealer discards after picking up ──
    if (state.phase === "discard") {
      if (seat !== state.dealer) return { state, ok: false, error: "Only the dealer discards." };
      if (action.type !== "discard") return { state, ok: false, error: "Discard a card." };
      const card = action.card as Card;
      const hands = state.hands.map((h) => h.slice());
      const idx = hands[seat].findIndex((c) => c.r === card.r && c.s === card.s);
      if (idx < 0) return { state, ok: false, error: "You don't hold that card." };
      hands[seat].splice(idx, 1);
      return { ok: true, state: { ...state, hands, phase: "playing", turn: state.leader, log: push(state.log, "Trump set. Lead off.") } };
    }

    // ── Trick play ──
    if (state.phase === "playing") {
      if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
      if (action.type !== "play" || !state.trump) return { state, ok: false, error: "Play a card." };
      const card = action.card as Card;
      const legal = this.legalActions(state, actor);
      if (!legal.some((a) => (a.card as Card).r === card.r && (a.card as Card).s === card.s))
        return { state, ok: false, error: "You must follow suit." };

      const hands = state.hands.map((h) => h.slice());
      hands[seat] = hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
      const trick = [...state.trick, { seat, card }];
      let log = state.log;
      const tricksWon: [number, number] = [state.tricksWon[0], state.tricksWon[1]];
      let leader = state.leader;
      let turn = state.turn;
      let trickCount = state.trickCount;

      if (trick.length === 4) {
        const winner = trick[trickWinnerEuchre(trick, state.trump)].seat;
        tricksWon[team(winner)] += 1;
        trickCount += 1;
        leader = winner;
        turn = winner;
        log = push(log, `${state.players[winner].name} takes trick ${trickCount}.`);
        if (trickCount === 5) return { ok: true, state: score({ ...state, hands, trick: [], tricksWon, trickCount, log }) };
        return { ok: true, state: { ...state, hands, trick: [], tricksWon, leader, turn, trickCount, log } };
      }
      turn = (turn + 1) % 4;
      return { ok: true, state: { ...state, hands, trick, turn, log } };
    }

    return { state, ok: false, error: "Unknown action." };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "euchre",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "bid1" || state.phase === "bid2" ? state.bidTurn === i : state.phase === "discard" ? state.dealer === i : state.turn === i),
        out: false,
        extra: { team: team(i), isMaker: state.maker != null && team(state.maker) === team(i) },
      })),
      turn: turnId(state),
      hand: seat >= 0 ? sortHand(state.hands[seat], state.trump) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        turned: state.turned,
        trump: state.trump,
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        tricksWon: state.tricksWon,
        trickCount: state.trickCount,
        dealerName: state.players[state.dealer].name,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const winTeam = state.scores[0] > state.scores[1] ? 0 : 1;
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    state.players.forEach((p, i) => (team(i) === winTeam ? winners : losers).push(p.id));
    return { over: true, winners, losers, message: `Team ${winTeam === 0 ? "A" : "B"} wins ${state.scores[winTeam]}–${state.scores[1 - winTeam]}.` };
  },
};

function score(state: EuchreState): EuchreState {
  const makerTeam = team(state.maker ?? 0);
  const makerTricks = state.tricksWon[makerTeam];
  const scores: [number, number] = [0, 0];
  let msg: string;
  if (makerTricks >= 3) {
    const pts = makerTricks === 5 ? 2 : 1;
    scores[makerTeam] = pts;
    msg = `Makers take ${makerTricks} — ${pts} point${pts > 1 ? "s (march!)" : ""}.`;
  } else {
    scores[1 - makerTeam] = 2;
    msg = "Euchred! Defenders score 2.";
  }
  return { ...state, phase: "over", over: true, scores, log: push(state.log, msg) };
}

function turnId(state: EuchreState): PlayerId | null {
  if (state.over) return null;
  const seat =
    state.phase === "bid1" || state.phase === "bid2" ? state.bidTurn : state.phase === "discard" ? state.dealer : state.turn;
  return state.players[seat].id;
}

const SUIT: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
function cardStr(c: Card): string {
  const r = (({ 1: "A", 11: "J", 12: "Q", 13: "K" }) as Record<number, string>)[c.r] ?? String(c.r);
  return `${r}${SUIT[c.s]}`;
}
function sortHand(hand: Card[], trump: Suit | null): Card[] {
  return [...hand].sort((a, b) => {
    if (trump) {
      const at = isTrump(a, trump) ? 1 : 0;
      const bt = isTrump(b, trump) ? 1 : 0;
      if (at !== bt) return bt - at;
    }
    return a.s.localeCompare(b.s) || a.r - b.r;
  });
}
