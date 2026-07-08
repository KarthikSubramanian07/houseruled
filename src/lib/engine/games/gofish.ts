// Go Fish - ask an opponent for a rank you hold; collect books of four.

import { standardDeck, shuffle, type Card, type Rank, RANK_LABEL } from "../cards";
import { makeRng } from "../rng";
import type { ApplyResult, GameDefinition, GameStatus, GameView, PlayerId, SeatInfo } from "../types";

interface GoFishState {
  type: "gofish";
  seed: number;
  rules: string[];
  players: SeatInfo[];
  hands: Card[][];
  pool: Card[];
  books: Rank[][]; // completed sets of four, per seat
  turn: number;
  over: boolean;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

/** Pull any completed books (4 of a rank) out of a hand. Mutates hand copy. */
function extractBooks(hand: Card[], books: Rank[]): { hand: Card[]; books: Rank[] } {
  const counts = new Map<Rank, number>();
  for (const c of hand) counts.set(c.r, (counts.get(c.r) ?? 0) + 1);
  const newBooks = [...books];
  let newHand = hand;
  for (const [r, n] of counts) {
    if (n >= 4) {
      newHand = newHand.filter((c) => c.r !== r);
      newBooks.push(r);
    }
  }
  return { hand: newHand, books: newBooks };
}

const TOTAL_BOOKS = 13;

export const gofish: GameDefinition<GoFishState> = {
  type: "gofish",
  name: "Go Fish",
  blurb: "Ask for ranks, hunt for sets of four. Whoever lands the most books wins.",
  minPlayers: 2,
  maxPlayers: 6,

  init(players, rules, seed) {
    const deck = shuffle(standardDeck(), makeRng(seed));
    const perHand = players.length <= 2 ? 7 : 5;
    const hands: Card[][] = players.map(() => []);
    let idx = 0;
    for (let n = 0; n < perHand; n++) {
      for (let p = 0; p < players.length; p++) hands[p].push(deck[idx++]);
    }
    const pool = deck.slice(idx);
    // Immediately book any dealt four-of-a-kinds.
    const books: Rank[][] = players.map(() => []);
    for (let p = 0; p < players.length; p++) {
      const r = extractBooks(hands[p], books[p]);
      hands[p] = r.hand;
      books[p] = r.books;
    }
    return {
      type: "gofish",
      seed,
      rules,
      players,
      hands,
      pool,
      books,
      turn: 0,
      over: false,
      log: ["Hands dealt. Go fish!"],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    const askAnything = state.rules.includes("gofish-ask-anything");
    const ranks: Rank[] = askAnything
      ? ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as Rank[])
      : [...new Set(hand.map((c) => c.r))];
    const actions = [];
    for (let t = 0; t < state.players.length; t++) {
      if (t === seat) continue;
      if (state.hands[t].length === 0) continue; // can't ask an empty-handed player
      for (const rank of ranks) {
        actions.push({ type: "ask", target: state.players[t].id, rank });
      }
    }
    return actions;
  },

  apply(state, actor, action): ApplyResult<GoFishState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    if (action.type !== "ask") return { state, ok: false, error: "Unknown action." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };

    const target = action.target as PlayerId;
    const rank = action.rank as Rank;
    const tSeat = state.players.findIndex((p) => p.id === target);
    if (tSeat < 0 || tSeat === seat) return { state, ok: false, error: "Pick another player." };
    if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(rank))
      return { state, ok: false, error: "Bad rank." };

    const hands = state.hands.map((h) => h.slice());
    const books = state.books.map((b) => b.slice());
    let pool = state.pool.slice();
    let log = state.log;
    const askAnything = state.rules.includes("gofish-ask-anything");
    const giveOne = state.rules.includes("gofish-give-one");

    if (!askAnything && !hands[seat].some((c) => c.r === rank))
      return { state, ok: false, error: "You must hold the rank you ask for." };

    const label = RANK_LABEL[rank];
    const matches = hands[tSeat].filter((c) => c.r === rank);
    let goAgain = false;

    if (matches.length > 0) {
      const give = giveOne ? matches.slice(0, 1) : matches;
      hands[tSeat] = hands[tSeat].filter((c) => !give.includes(c));
      hands[seat] = hands[seat].concat(give);
      log = push(log, `${state.players[seat].name} took ${give.length}×${label} from ${state.players[tSeat].name}.`);
      goAgain = true; // a successful ask earns another turn
    } else {
      log = push(log, `${state.players[tSeat].name} says "Go fish!"`);
      if (pool.length > 0) {
        const drawn = pool[0];
        pool = pool.slice(1);
        hands[seat].push(drawn);
        // Lucky draw of the asked rank → go again (standard rule).
        if (drawn.r === rank) {
          log = push(log, `${state.players[seat].name} fished the ${label} - go again!`);
          goAgain = true;
        }
      }
    }

    // Book any completed sets for the asker.
    const bk = extractBooks(hands[seat], books[seat]);
    hands[seat] = bk.hand;
    books[seat] = bk.books;

    let next = state.turn;
    let over = false;
    const totalBooks = books.reduce((n, b) => n + b.length, 0);
    if (totalBooks >= TOTAL_BOOKS) {
      over = true;
    } else if (!goAgain) {
      // Pass to the next player who can act, drawing them a card if empty.
      const r = passTurn(state.players.length, hands, pool, state.turn);
      if (r.over) {
        over = true;
      } else {
        next = r.turn;
        pool = r.pool;
        hands[next] = r.hand;
        if (r.drew) log = push(log, `${state.players[next].name} draws to stay in.`);
      }
    } else if (hands[seat].length === 0 && pool.length > 0) {
      // Asker earned another turn but emptied their hand - refill one.
      hands[seat].push(pool[0]);
      pool = pool.slice(1);
    } else if (hands[seat].length === 0 && pool.length === 0) {
      // Nothing left to do; pass.
      const r = passTurn(state.players.length, hands, pool, state.turn);
      over = r.over;
      if (!r.over) { next = r.turn; pool = r.pool; hands[next] = r.hand; }
    }

    if (over) {
      const winMsg = winnerMessage(state.players, books);
      log = push(log, winMsg);
    }

    return { ok: true, state: { ...state, hands, books, pool, turn: next, over, log } };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    return {
      type: "gofish",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: state.hands[i].length === 0 && state.pool.length === 0,
        extra: { books: state.books[i].length },
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: { poolCount: state.pool.length },
      status: this.status(state),
      log: state.log,
      rules: state.rules,
    };
  },

  status(state): GameStatus {
    if (!state.over) return { over: false, winners: [], losers: [] };
    const max = Math.max(...state.books.map((b) => b.length));
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    state.players.forEach((p, i) => {
      if (state.books[i].length === max) winners.push(p.id);
      else losers.push(p.id);
    });
    return { over: true, winners, losers, message: winnerMessage(state.players, state.books) };
  },
};

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
}

function passTurn(
  count: number,
  hands: Card[][],
  pool: Card[],
  from: number,
): { turn: number; pool: Card[]; hand: Card[]; drew: boolean; over: boolean } {
  let i = from;
  for (let guard = 0; guard < count; guard++) {
    i = (i + 1) % count;
    if (hands[i].length > 0) return { turn: i, pool, hand: hands[i], drew: false, over: false };
    if (pool.length > 0) {
      // Refill an empty-handed player so they can act.
      return { turn: i, pool: pool.slice(1), hand: [...hands[i], pool[0]], drew: true, over: false };
    }
  }
  return { turn: from, pool, hand: hands[from], drew: false, over: true };
}

function winnerMessage(players: SeatInfo[], books: Rank[][]): string {
  const max = Math.max(...books.map((b) => b.length));
  const winners = players.filter((_, i) => books[i].length === max);
  if (winners.length === 1) return `${winners[0].name} wins with ${max} books!`;
  return `It's a tie at ${max} books!`;
}
