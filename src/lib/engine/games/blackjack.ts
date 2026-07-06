// Blackjack vs the dealer. Hit/stand/bust, soft aces, win-lose-push (no betting).
// Player hands are public (blackjack is an open game); the dealer's hole card is
// hidden until every player has finished, then the dealer plays automatically.

import { standardDeck, shuffle, handTotal, type Card } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";

type Result = "win" | "lose" | "push";

interface BJState {
  type: "blackjack";
  seed: number;
  rules: string[];
  players: SeatInfo[];
  hands: Card[][];
  dealer: Card[]; // index 1 is the hole card
  shoe: Card[];
  turn: number; // current player seat; -1 once the dealer plays / game over
  standing: boolean[];
  results: (Result | null)[];
  phase: "players" | "over";
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}
const isBlackjack = (h: Card[]) => h.length === 2 && handTotal(h).total === 21;

/** Play the dealer out and score every hand — produces the final over-state. */
function settle(s: BJState): BJState {
  const dealerHitsSoft17 = s.rules.includes("bj-dealer-hits-soft-17");
  const dealer = s.dealer.slice();
  let shoe = s.shoe.slice();
  let log = s.log;
  for (let guard = 0; guard < 30; guard++) {
    const { total, soft } = handTotal(dealer);
    if (total < 17 || (total === 17 && soft && dealerHitsSoft17)) {
      if (shoe.length === 0) break;
      dealer.push(shoe.shift()!);
    } else break;
  }
  const dt = handTotal(dealer).total;
  const dBust = dt > 21;
  const dBJ = isBlackjack(dealer);
  log = push(log, `Dealer ${dBust ? "busts" : `stands on ${dt}`}.`);

  const charlie = s.rules.includes("bj-five-card-charlie");
  const dealerWinsTies = s.rules.includes("bj-dealer-wins-ties");
  const results: Result[] = s.hands.map((h) => {
    const pt = handTotal(h).total;
    if (pt > 21) return "lose";
    if (charlie && h.length >= 5) return "win";
    const pBJ = isBlackjack(h);
    if (dBJ && !pBJ) return "lose";
    if (pBJ && !dBJ) return "win";
    if (dBust) return "win";
    if (pt > dt) return "win";
    if (pt < dt) return "lose";
    return dealerWinsTies ? "lose" : "push";
  });

  return { ...s, dealer, shoe, turn: -1, phase: "over", results, log };
}

export const blackjack: GameDefinition<BJState> = {
  type: "blackjack",
  name: "Blackjack",
  blurb: "Beat the dealer to 21 without busting. Hit, stand, and pray for aces.",
  minPlayers: 1,
  maxPlayers: 6,

  init(players, rules, seed) {
    const shoe = shuffle(standardDeck(), makeRng(seed));
    const hands: Card[][] = players.map(() => []);
    let i = 0;
    for (let n = 0; n < 2; n++) for (let p = 0; p < players.length; p++) hands[p].push(shoe[i++]);
    const dealer = [shoe[i++], shoe[i++]];
    const rest = shoe.slice(i);
    const standing = hands.map((h) => isBlackjack(h)); // naturals stand immediately
    const firstTurn = standing.findIndex((s) => !s);
    const base: BJState = {
      type: "blackjack",
      seed,
      rules,
      players,
      hands,
      dealer,
      shoe: rest,
      turn: firstTurn,
      standing,
      results: players.map(() => null),
      phase: "players",
      log: ["Cards dealt. Hit or stand."],
    };
    // Everyone was dealt a natural — go straight to the dealer.
    return firstTurn < 0 ? settle(base) : base;
  },

  legalActions(state, viewer) {
    if (state.phase === "over") return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn || state.standing[seat]) return [];
    return [{ type: "hit" }, { type: "stand" }];
  },

  apply(state, actor, action): ApplyResult<BJState> {
    if (state.phase === "over") return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
    if (state.standing[seat]) return { state, ok: false, error: "You're already standing." };

    const hands = state.hands.map((h) => h.slice());
    const standing = state.standing.slice();
    const shoe = state.shoe.slice();
    let log = state.log;

    if (action.type === "hit") {
      if (shoe.length === 0) return { state, ok: false, error: "Shoe empty." };
      const c = shoe.shift()!;
      hands[seat].push(c);
      const { total } = handTotal(hands[seat]);
      log = push(log, `${state.players[seat].name} hits ${c.r}${c.s} (${total}).`);
      if (total >= 21) {
        standing[seat] = true;
        if (total > 21) log = push(log, `${state.players[seat].name} busts!`);
      }
    } else if (action.type === "stand") {
      standing[seat] = true;
      log = push(log, `${state.players[seat].name} stands on ${handTotal(hands[seat]).total}.`);
    } else {
      return { state, ok: false, error: "Unknown action." };
    }

    // Next player still acting?
    let next = -1;
    for (let k = 1; k <= state.players.length; k++) {
      const idx = (seat + k) % state.players.length;
      if (!standing[idx]) { next = idx; break; }
    }
    if (next >= 0) {
      return { ok: true, state: { ...state, hands, standing, shoe, turn: next, log } };
    }
    // Everyone done → dealer plays and we settle.
    return { ok: true, state: settle({ ...state, hands, standing, shoe, log }) };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    const revealed = state.phase === "over";
    const dealerCards = revealed ? state.dealer : [state.dealer[0]];
    return {
      type: "blackjack",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: state.phase !== "over" && state.turn === i,
        out: false,
        extra: {
          cards: state.hands[i], // public in blackjack
          total: handTotal(state.hands[i]).total,
          standing: state.standing[i],
          result: state.results[i],
        },
      })),
      turn: state.phase === "over" ? null : state.players[state.turn]?.id ?? null,
      hand: seat >= 0 ? state.hands[seat] : [],
      legal: this.legalActions(state, viewer),
      center: {
        dealer: dealerCards,
        dealerTotal: revealed ? handTotal(state.dealer).total : undefined,
        dealerHiddenCount: revealed ? 0 : 1,
        shoeCount: state.shoe.length,
        phase: state.phase,
      },
      status: this.status(state),
      log: state.log,
      rules: state.rules,
    };
  },

  status(state): GameStatus {
    if (state.phase !== "over") return { over: false, winners: [], losers: [] };
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    state.players.forEach((p, i) => {
      if (state.results[i] === "win") winners.push(p.id);
      else if (state.results[i] === "lose") losers.push(p.id);
    });
    const parts = state.players.map((p, i) => `${p.name} ${state.results[i]}s`);
    return { over: true, winners, losers, message: parts.join(", ") + "." };
  },
};
