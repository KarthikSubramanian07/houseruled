// 500 / Five Hundred (4 players, partnerships) — the Australian classic. A 43-card
// deck (red 4s up, black 5s up, plus the Joker) is dealt 10 each with a 3-card
// kitty. Bid for the number of tricks (6–10) and a trump suit (or no-trump); the
// Avondale schedule sets the value. The winner takes the kitty, discards 3, and
// their partnership tries to make the contract. Bowers and the Joker are the top
// trumps. First partnership to 500 wins; drop to −500 and you lose.

import { SUITS, isJoker, JOKER, type Card, type Suit, type Rank } from "../cards";
import { shuffle } from "../cards";
import { makeRng } from "../rng";
import { nextActiveIndex, type ApplyResult, type GameDefinition, type GameStatus, type GameView, type SeatInfo } from "../types";

type Bid = Suit | "NT";
const BID_ORDER: Bid[] = ["S", "C", "D", "H", "NT"]; // ascending value
const BID_LABEL: Record<Bid, string> = { S: "♠", C: "♣", D: "♦", H: "♥", NT: "No-trump" };
const team = (seat: number) => seat % 2;
const isRedSuit = (s: Suit) => s === "H" || s === "D";
const sameColor = (a: Suit, b: Suit) => isRedSuit(a) === isRedSuit(b);
/** Rank order with Ace high (A=14 … 4=4). */
const ord = (r: Rank) => (r === 1 ? 14 : r);
const jkey = (c: Card) => (c.j ? "JK" : `${c.r}${c.s}`);

/** Avondale schedule: 6♠=40 … 10 NT=520. */
export function bidValue(tricks: number, bid: Bid): number {
  return (tricks - 6) * 100 + 40 + BID_ORDER.indexOf(bid) * 20;
}

export function fiveHundredDeck(): Card[] {
  const cards: Card[] = [];
  for (const s of SUITS) {
    const ranks: Rank[] = isRedSuit(s) ? [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1] : [5, 6, 7, 8, 9, 10, 11, 12, 13, 1];
    for (const r of ranks) cards.push({ s, r });
  }
  cards.push({ ...JOKER });
  return cards; // 22 + 20 + 1 = 43
}

interface PlayedCard { seat: number; card: Card }

interface FiveState {
  type: "fivehundred";
  seed: number;
  deal: number;
  players: SeatInfo[]; // 4
  dealer: number;
  hands: Card[][];
  kitty: Card[];
  phase: "bidding" | "kitty" | "playing" | "over";
  passed: boolean[];
  bidTurn: number;
  highBid: { seat: number; tricks: number; bid: Bid; value: number } | null;
  contract: { tricks: number; bid: Bid; value: number } | null;
  declarer: number;
  trick: PlayedCard[];
  leader: number;
  turn: number;
  tricksWon: [number, number];
  trickCount: number;
  teamScores: [number, number];
  over: boolean;
  winnerTeam: number | null;
  breakdown: string;
  log: string[];
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-12);
}

// ── Trump / trick mechanics (bowers + joker) ──────────────────────────────────

export function isTrump(c: Card, bid: Bid): boolean {
  if (bid === "NT") return isJoker(c);
  if (isJoker(c)) return true;
  if (c.s === bid) return true;
  return c.r === 11 && sameColor(c.s, bid); // left bower
}

/** The suit a card "belongs to" for following: bowers + joker follow trump. */
function effSuit(c: Card, bid: Bid): Suit | "*" {
  if (bid === "NT") return isJoker(c) ? "*" : c.s;
  if (isTrump(c, bid)) return bid;
  return c.s;
}

/** Strength for winning a trick given the led suit; -1 means it can't win. */
function strength(c: Card, bid: Bid, led: Suit | "*"): number {
  if (bid === "NT") {
    if (isJoker(c)) return 2000;
    return c.s === led ? ord(c.r) : -1;
  }
  if (isTrump(c, bid)) {
    if (isJoker(c)) return 1060;
    if (c.r === 11 && c.s === bid) return 1059; // right bower
    if (c.r === 11 && sameColor(c.s, bid)) return 1058; // left bower
    return 1000 + ord(c.r);
  }
  return c.s === led ? ord(c.r) : -1;
}

export function trickWinner(trick: PlayedCard[], bid: Bid): number {
  const led = effSuit(trick[0].card, bid);
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    if (strength(trick[i].card, bid, led) > strength(trick[best].card, bid, led)) best = i;
  }
  return trick[best].seat;
}

/** Cards that legally follow the led suit, or the whole hand if void. */
export function legalPlays(hand: Card[], trick: PlayedCard[], bid: Bid): Card[] {
  if (trick.length === 0) return hand.slice();
  const led = effSuit(trick[0].card, bid);
  const following = hand.filter((c) => effSuit(c, bid) === led);
  return following.length > 0 ? following : hand.slice();
}

// ── Deal / scoring ────────────────────────────────────────────────────────────

function dealHands(s: FiveState, dealer: number): FiveState {
  const deck = shuffle(fiveHundredDeck(), makeRng(s.seed + s.deal * 149 + 3));
  const hands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30), deck.slice(30, 40)];
  return {
    ...s,
    dealer,
    hands,
    kitty: deck.slice(40),
    phase: "bidding",
    passed: [false, false, false, false],
    bidTurn: (dealer + 1) % 4,
    highBid: null,
    contract: null,
    declarer: -1,
    trick: [],
    leader: (dealer + 1) % 4,
    turn: (dealer + 1) % 4,
    tricksWon: [0, 0],
    trickCount: 0,
    log: push(s.log, `Deal ${s.deal + 1} — ${s.players[dealer].name} deals. Bidding opens.`),
  };
}

function scoreDeal(s: FiveState): FiveState {
  const c = s.contract!;
  const dTeam = team(s.declarer);
  const oppTeam = dTeam === 0 ? 1 : 0;
  const made = s.tricksWon[dTeam] >= c.tricks;
  const teamScores: [number, number] = [s.teamScores[0], s.teamScores[1]];
  const parts: string[] = [];
  if (made) {
    let pts = c.value;
    if (c.tricks < 10 && s.tricksWon[dTeam] === 10 && pts < 250) pts = 250; // slam bonus floor
    teamScores[dTeam] += pts;
    parts.push(`${s.players[s.declarer].name}'s team made ${c.tricks}${BID_LABEL[c.bid]} (+${pts})`);
  } else {
    teamScores[dTeam] -= c.value;
    parts.push(`set — ${s.players[s.declarer].name}'s team −${c.value}`);
  }
  const oppPts = s.tricksWon[oppTeam] * 10;
  teamScores[oppTeam] += oppPts;
  if (oppPts) parts.push(`opponents +${oppPts} (${s.tricksWon[oppTeam]} tricks)`);

  const done = teamScores[0] >= 500 || teamScores[1] >= 500 || teamScores[0] <= -500 || teamScores[1] <= -500;
  let winnerTeam: number | null = null;
  if (done) {
    if (teamScores[dTeam] >= 500 && made) winnerTeam = dTeam;
    else if (teamScores[0] <= -500) winnerTeam = 1;
    else if (teamScores[1] <= -500) winnerTeam = 0;
    else winnerTeam = teamScores[0] >= teamScores[1] ? 0 : 1;
  }
  const breakdown = parts.join(" · ");
  const scored: FiveState = { ...s, teamScores, breakdown, log: push(s.log, `${breakdown}. Score ${teamScores[0]}–${teamScores[1]}.`) };
  if (done) return { ...scored, phase: "over", over: true, winnerTeam };
  return dealHands({ ...scored, deal: s.deal + 1 }, (s.dealer + 1) % 4);
}

// ── Definition ──────────────────────────────────────────────────────────────

export const fivehundred: GameDefinition<FiveState> = {
  type: "fivehundred",
  name: "500",
  blurb: "Partnership bidding and trick-taking with bowers and the Joker. Make your contract; race to 500.",
  minPlayers: 4,
  maxPlayers: 4,

  init(players, _rules, seed) {
    const base: FiveState = {
      type: "fivehundred",
      seed,
      deal: 0,
      players: players.slice(0, 4),
      dealer: 3,
      hands: [[], [], [], []],
      kitty: [],
      phase: "bidding",
      passed: [false, false, false, false],
      bidTurn: 0,
      highBid: null,
      contract: null,
      declarer: -1,
      trick: [],
      leader: 0,
      turn: 0,
      tricksWon: [0, 0],
      trickCount: 0,
      teamScores: [0, 0],
      over: false,
      winnerTeam: null,
      breakdown: "",
      log: ["Bid for tricks + trump, or pass."],
    };
    return dealHands(base, 3);
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat < 0) return [];

    if (state.phase === "bidding") {
      if (seat !== state.bidTurn || state.passed[seat]) return [];
      const floor = state.highBid?.value ?? 0;
      const bids: { type: string; tricks: number; suit: Bid }[] = [];
      for (let t = 6; t <= 10; t++) for (const b of BID_ORDER) if (bidValue(t, b) > floor) bids.push({ type: "bid", tricks: t, suit: b });
      return [...bids, { type: "pass" }];
    }
    if (state.phase === "kitty") {
      if (seat !== state.declarer || state.hands[seat].length <= 10) return [];
      return state.hands[seat].map((card) => ({ type: "kitty", card }));
    }
    if (state.phase === "playing") {
      if (seat !== state.turn) return [];
      return legalPlays(state.hands[seat], state.trick, state.contract!.bid).map((card) => ({ type: "play", card }));
    }
    return [];
  },

  apply(state, actor, action): ApplyResult<FiveState> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat < 0) return { state, ok: false, error: "Not a player." };

    // ── Bidding ──
    if (state.phase === "bidding") {
      if (seat !== state.bidTurn || state.passed[seat]) return { state, ok: false, error: "Not your turn to bid." };
      if (action.type === "bid") {
        const tricks = action.tricks as number;
        const bid = action.suit as Bid;
        if (!BID_ORDER.includes(bid) || tricks < 6 || tricks > 10) return { state, ok: false, error: "Invalid bid." };
        const value = bidValue(tricks, bid);
        if (value <= (state.highBid?.value ?? 0)) return { state, ok: false, error: "Bid must beat the standing bid." };
        const highBid = { seat, tricks, bid, value };
        const log = push(state.log, `${state.players[seat].name} bids ${tricks} ${BID_LABEL[bid]} (${value}).`);
        const nextSeat = nextActiveIndex(4, seat, 1, (i) => state.passed[i]);
        const next: FiveState = { ...state, highBid, bidTurn: nextSeat, log };
        // Only the bidder remains active → they win the contract.
        if (state.passed.filter((p) => !p).length === 1) return { ok: true, state: enterKitty(next) };
        return { ok: true, state: next };
      }
      if (action.type === "pass") {
        const passed = state.passed.slice();
        passed[seat] = true;
        const log = push(state.log, `${state.players[seat].name} passes.`);
        const activeLeft = passed.filter((p) => !p).length;
        if (state.highBid && activeLeft === 1) return { ok: true, state: enterKitty({ ...state, passed, log }) };
        if (activeLeft === 0) {
          // Everyone passed — redeal with the next dealer.
          return { ok: true, state: dealHands({ ...state, passed, deal: state.deal + 1, log: push(log, "All pass — redeal.") }, (state.dealer + 1) % 4) };
        }
        const nextSeat = nextActiveIndex(4, seat, 1, (i) => passed[i]);
        return { ok: true, state: { ...state, passed, bidTurn: nextSeat, log } };
      }
      return { state, ok: false, error: "Bid or pass." };
    }

    // ── Kitty exchange ──
    if (state.phase === "kitty") {
      if (seat !== state.declarer) return { state, ok: false, error: "Only the declarer discards." };
      if (action.type !== "kitty") return { state, ok: false, error: "Discard a card." };
      const card = action.card as Card;
      if (!state.hands[seat].some((c) => jkey(c) === jkey(card))) return { state, ok: false, error: "You don't hold that." };
      const hands = state.hands.map((h) => h.slice());
      hands[seat] = hands[seat].filter((c) => jkey(c) !== jkey(card));
      let next: FiveState = { ...state, hands };
      if (hands[seat].length === 10) {
        next = { ...next, phase: "playing", leader: seat, turn: seat, log: push(state.log, `${state.players[seat].name} is set. Play begins.`) };
      }
      return { ok: true, state: next };
    }

    // ── Play ──
    if (state.phase === "playing") {
      if (action.type !== "play") return { state, ok: false, error: "Play a card." };
      if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };
      const card = action.card as Card;
      const legal = legalPlays(state.hands[seat], state.trick, state.contract!.bid);
      if (!legal.some((c) => jkey(c) === jkey(card))) return { state, ok: false, error: "You must follow suit." };

      const hands = state.hands.map((h) => h.slice());
      hands[seat] = hands[seat].filter((c) => jkey(c) !== jkey(card));
      const trick = [...state.trick, { seat, card }];
      let log = state.log;
      const tricksWon: [number, number] = [state.tricksWon[0], state.tricksWon[1]];
      let leader = state.leader;
      let turn: number;
      let trickCount = state.trickCount;

      if (trick.length === 4) {
        const winner = trickWinner(trick, state.contract!.bid);
        tricksWon[team(winner)] += 1;
        trickCount += 1;
        leader = winner;
        turn = winner;
        log = push(log, `${state.players[winner].name} takes trick ${trickCount}.`);
        if (trickCount === 10) {
          return { ok: true, state: scoreDeal({ ...state, hands, trick: [], tricksWon, trickCount, leader, turn, log }) };
        }
        return { ok: true, state: { ...state, hands, trick: [], tricksWon, trickCount, leader, turn, log } };
      }
      turn = (seat + 1) % 4;
      return { ok: true, state: { ...state, hands, trick, turn, log } };
    }

    return { state, ok: false, error: "Nothing to do." };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    const bid = state.contract?.bid ?? state.highBid?.bid ?? null;
    return {
      type: "fivehundred",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && (state.phase === "bidding" ? state.bidTurn === i && !state.passed[i] : state.phase === "kitty" ? state.declarer === i : state.turn === i),
        out: state.phase === "bidding" && state.passed[i],
        extra: {
          team: team(i),
          isDeclarer: state.declarer === i,
          isDealer: state.dealer === i,
          teamScore: state.teamScores[team(i)],
          passed: state.passed[i],
        },
      })),
      turn: state.over ? null : state.phase === "bidding" ? state.players[state.bidTurn].id : state.phase === "kitty" ? state.players[state.declarer].id : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat], bid) : [],
      legal: this.legalActions(state, viewer),
      center: {
        phase: state.phase,
        contract: state.contract ? { tricks: state.contract.tricks, bid: state.contract.bid, label: BID_LABEL[state.contract.bid] } : null,
        highBid: state.highBid ? { tricks: state.highBid.tricks, label: BID_LABEL[state.highBid.bid], name: state.players[state.highBid.seat].name, value: state.highBid.value } : null,
        declarerName: state.declarer >= 0 ? state.players[state.declarer].name : null,
        trump: bid,
        trick: state.trick.map((p) => ({ card: p.card, name: state.players[p.seat].name })),
        trickCount: state.trickCount,
        tricksWon: state.tricksWon,
        teamScores: state.teamScores,
        kittyPickup: state.phase === "kitty" && seat === state.declarer,
      },
      status: this.status(state),
      log: state.log,
      rules: [],
    };
  },

  status(state): GameStatus {
    if (!state.over || state.winnerTeam == null) return { over: false, winners: [], losers: [] };
    const w = state.winnerTeam;
    const winners = state.players.filter((_, i) => team(i) === w).map((p) => p.id);
    const losers = state.players.filter((_, i) => team(i) !== w).map((p) => p.id);
    return { over: true, winners, losers, message: `Team ${w === 0 ? "A" : "B"} wins ${state.teamScores[w]}–${state.teamScores[w === 0 ? 1 : 0]}.` };
  },
};

/** Winning bidder takes the kitty into hand; they then discard back down to 10. */
function enterKitty(s: FiveState): FiveState {
  const declarer = s.highBid!.seat;
  const hands = s.hands.map((h) => h.slice());
  hands[declarer] = [...hands[declarer], ...s.kitty];
  return {
    ...s,
    phase: "kitty",
    declarer,
    contract: { tricks: s.highBid!.tricks, bid: s.highBid!.bid, value: s.highBid!.value },
    hands,
    kitty: [],
    log: push(s.log, `${s.players[declarer].name} wins the bid and takes the kitty — discard 3.`),
  };
}

/** Sort a hand: trumps (by strength) grouped left, then other suits by rank. */
function sortHand(hand: Card[], bid: Bid | null): Card[] {
  if (!bid) return [...hand].sort((a, b) => (a.j ? 1 : b.j ? -1 : a.s.localeCompare(b.s) || ord(a.r) - ord(b.r)));
  const rank = (c: Card) => (isTrump(c, bid) ? 100 + strength(c, bid, bid === "NT" ? "*" : bid) / 10 : 0);
  return [...hand].sort((a, b) => {
    const ta = isTrump(a, bid), tb = isTrump(b, bid);
    if (ta !== tb) return ta ? -1 : 1;
    if (ta && tb) return rank(b) - rank(a);
    return a.s.localeCompare(b.s) || ord(a.r) - ord(b.r);
  });
}
