// Crazy Eights - match suit or rank, 8s are wild. The showcase for Phase 2 house
// rules: 2s draw two / skip, Queens skip / reverse, Jacks skip, Aces reverse,
// stacking draws, and draw-until-playable. All effects are gated on active rules.

import { standardDeck, shuffle, type Card, type Suit, type Rank } from "../cards";
import { makeRng } from "../rng";
import { nextActiveIndex, type ApplyResult, type GameDefinition, type GameStatus, type GameView, type SeatInfo } from "../types";
import { type AIRule, activeRules, aiCardEffects, isWildByRule, summarizeRule } from "../airules";

interface CE8State {
  type: "crazyeights";
  seed: number;
  shuffles: number;
  rules: string[];
  aiRules: AIRule[]; // Phase 3 free-text rules (structured + validated)
  plays: number; // total cards played, for round-limited rule expiry
  players: SeatInfo[];
  hands: Card[][];
  draw: Card[];
  discard: Card[]; // last = top
  currentSuit: Suit; // active suit (differs from top after an 8)
  turn: number;
  dir: 1 | -1;
  mustDraw: number; // accumulated draw penalty facing the current player
  justDrew: Card | null; // a card drawn this turn awaiting play/pass
  passStreak: number; // consecutive no-progress passes → blocked game
  over: boolean;
  winner: number | null;
  log: string[];
}

/** Rules currently in force (round-limited ones expire by play count). */
function liveRules(state: CE8State): AIRule[] {
  return activeRules(state.aiRules, state.plays, state.players.length);
}
function isWild(card: Card, rules: AIRule[]): boolean {
  return card.r === 8 || isWildByRule(card, rules);
}

/** When the whole table is stuck (draw exhausted, nobody can play), fewest cards wins. */
function blockedWinner(hands: Card[][]): number {
  let best = 0;
  for (let i = 1; i < hands.length; i++) if (hands[i].length < hands[best].length) best = i;
  return best;
}

/** Increment the pass streak; if everyone has passed in a row, end as blocked. */
function endOrPass(
  prev: CE8State,
  next: CE8State,
  _seat: number,
  nextTurn: number,
  log: string[],
): ApplyResult<CE8State> {
  const streak = prev.passStreak + 1;
  if (streak >= prev.players.length) {
    const w = blockedWinner(next.hands);
    return {
      ok: true,
      state: { ...next, passStreak: streak, over: true, winner: w, log: push(log, `Table blocked - ${prev.players[w].name} wins with the fewest cards.`) },
    };
  }
  return { ok: true, state: { ...next, passStreak: streak, turn: nextTurn, log } };
}

function push(log: string[], line: string): string[] {
  return [...log, line].slice(-10);
}

function isPlayable(card: Card, currentSuit: Suit, topRank: Rank): boolean {
  return card.r === 8 || card.s === currentSuit || card.r === topRank;
}

interface Effects {
  skip: number;
  reverse: boolean;
  draw: number;
}
function cardEffects(rank: Rank, rules: string[]): Effects {
  const e: Effects = { skip: 0, reverse: false, draw: 0 };
  if (rank === 2) {
    if (rules.includes("ce8-twos-draw-two")) e.draw = 2;
    else if (rules.includes("ce8-twos-skip")) e.skip = 1;
  } else if (rank === 12) {
    if (rules.includes("ce8-queens-reverse")) e.reverse = true;
    else if (rules.includes("ce8-queens-skip")) e.skip = 1;
  } else if (rank === 11) {
    if (rules.includes("ce8-jacks-skip")) e.skip = 1;
  } else if (rank === 1) {
    if (rules.includes("ce8-aces-reverse")) e.reverse = true;
    else if (rules.includes("ce8-aces-skip")) e.skip = 1;
  } else if (rank === 13) {
    if (rules.includes("ce8-kings-skip")) e.skip = 1;
  }
  return e;
}

/** Draw n cards, reshuffling the discard (minus its top) into the draw pile when empty. */
function drawFrom(
  draw: Card[],
  discard: Card[],
  seed: number,
  shuffles: number,
  n: number,
): { drawn: Card[]; draw: Card[]; discard: Card[]; shuffles: number } {
  let d = draw.slice();
  let dis = discard.slice();
  const drawn: Card[] = [];
  let sh = shuffles;
  for (let i = 0; i < n; i++) {
    if (d.length === 0) {
      if (dis.length <= 1) break; // nothing left to reshuffle
      const top = dis[dis.length - 1];
      const rest = dis.slice(0, -1);
      sh += 1;
      d = shuffle(rest, makeRng(seed + sh));
      dis = [top];
    }
    drawn.push(d.shift()!);
  }
  return { drawn, draw: d, discard: dis, shuffles: sh };
}

function canEverDraw(state: CE8State): boolean {
  return state.draw.length > 0 || state.discard.length > 1;
}

export const crazyeights: GameDefinition<CE8State> = {
  type: "crazyeights",
  name: "Crazy Eights",
  blurb: "Match the suit or rank, or play a wild 8. First to empty their hand wins.",
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
    const top = deck[idx++];
    const draw = deck.slice(idx);
    return {
      type: "crazyeights",
      seed,
      shuffles: 0,
      rules,
      aiRules: [],
      plays: 0,
      players,
      hands,
      draw,
      discard: [top],
      currentSuit: top.s,
      turn: 0,
      dir: 1,
      mustDraw: 0,
      justDrew: null,
      passStreak: 0,
      over: false,
      winner: null,
      log: [`Top card: ${top.r}${top.s}. Match suit or rank, or play an 8.`],
    };
  },

  legalActions(state, viewer) {
    if (state.over) return [];
    const seat = state.players.findIndex((p) => p.id === viewer);
    if (seat !== state.turn) return [];
    const hand = state.hands[seat];
    const top = state.discard[state.discard.length - 1];
    const live = liveRules(state);

    // Facing a draw penalty.
    if (state.mustDraw > 0) {
      const actions: { type: string; card?: Card; wild?: boolean }[] = [{ type: "draw" }];
      if (state.rules.includes("ce8-stack-twos")) {
        for (const c of hand) if (c.r === 2) actions.push({ type: "play", card: c });
      }
      return actions;
    }

    // Just drew a card - decide play-or-pass (or keep drawing).
    if (state.justDrew) {
      const playable = isPlayable(state.justDrew, state.currentSuit, top.r);
      if (state.rules.includes("ce8-draw-until-play")) {
        if (playable) return [{ type: "play", card: state.justDrew, wild: isWild(state.justDrew, live) }];
        return canEverDraw(state) ? [{ type: "draw" }] : [{ type: "pass" }];
      }
      const out: { type: string; card?: Card; wild?: boolean }[] = [{ type: "pass" }];
      if (playable) out.unshift({ type: "play", card: state.justDrew, wild: isWild(state.justDrew, live) });
      return out;
    }

    // Normal turn.
    const playable = hand.filter((c) => isPlayable(c, state.currentSuit, top.r));
    if (playable.length > 0) return playable.map((c) => ({ type: "play", card: c, wild: isWild(c, live) }));
    return canEverDraw(state) ? [{ type: "draw" }] : [{ type: "pass" }];
  },

  apply(state, actor, action): ApplyResult<CE8State> {
    if (state.over) return { state, ok: false, error: "Game over." };
    const seat = state.players.findIndex((p) => p.id === actor);
    if (seat !== state.turn) return { state, ok: false, error: "Not your turn." };

    const hands = state.hands.map((h) => h.slice());
    let draw = state.draw.slice();
    let discard = state.discard.slice();
    let shuffles = state.shuffles;
    let log = state.log;
    let dir = state.dir;
    let mustDraw = state.mustDraw;
    let currentSuit = state.currentSuit;
    let justDrew = state.justDrew;
    const top = discard[discard.length - 1];
    const count = state.players.length;
    const stack = state.rules.includes("ce8-stack-twos");

    const advance = (skip: number) =>
      nextActiveIndex(count, seat, dir, () => false, skip);

    if (action.type === "play") {
      const card = action.card as Card | undefined;
      if (!card) return { state, ok: false, error: "No card given." };
      const idx = hands[seat].findIndex((c) => c.r === card.r && c.s === card.s);
      if (idx < 0) return { state, ok: false, error: "You don't hold that card." };

      // Under penalty, only a 2 (with stacking) may be played.
      if (mustDraw > 0) {
        if (!(stack && card.r === 2)) return { state, ok: false, error: "You must draw the penalty." };
      } else if (justDrew) {
        if (card.r !== justDrew.r || card.s !== justDrew.s)
          return { state, ok: false, error: "You may only play the card you drew." };
      } else if (!isPlayable(card, currentSuit, top.r)) {
        return { state, ok: false, error: "That card doesn't match." };
      }

      // Wild cards (8s, or made wild by a free-text rule) need a declared suit.
      const live = liveRules(state);
      const wild = isWild(card, live);
      let declared: Suit = card.s;
      if (wild) {
        const suit = action.suit as Suit | undefined;
        if (!suit || !["S", "H", "D", "C"].includes(suit))
          return { state, ok: false, error: "Choose a suit for your wild card." };
        declared = suit;
      }

      hands[seat].splice(idx, 1);
      discard.push(card);
      currentSuit = declared;
      justDrew = null;
      const plays = state.plays + 1;

      // Combine Phase 2 toggle effects with Phase 3 free-text rule effects.
      const eff = cardEffects(card.r, state.rules);
      const ai = aiCardEffects(card, live);
      const reverse = eff.reverse !== ai.reverse; // XOR
      const drawEff = eff.draw + ai.draw;
      const skip = eff.skip + ai.skip;
      if (reverse) dir = (dir === 1 ? -1 : 1) as 1 | -1;
      if (drawEff > 0) mustDraw = (stack ? mustDraw : 0) + drawEff;

      log = push(log, `${state.players[seat].name} played ${card.r}${card.s}${wild ? ` → ${declared}` : ""}.`);

      if (hands[seat].length === 0) {
        log = push(log, `${state.players[seat].name} is out - game over!`);
        return {
          ok: true,
          state: { ...state, hands, draw, discard, currentSuit, dir, plays, mustDraw: 0, justDrew: null, over: true, winner: seat, log },
        };
      }

      // "Play again" keeps the turn (unless it created a draw penalty to pass on).
      const nextTurn = ai.playAgain && mustDraw === 0 ? seat : advance(skip);
      return { ok: true, state: { ...state, hands, draw, discard, currentSuit, dir, plays, mustDraw, justDrew: null, passStreak: 0, turn: nextTurn, log } };
    }

    if (action.type === "draw") {
      if (mustDraw > 0) {
        // Take the whole penalty, then pass.
        const r = drawFrom(draw, discard, state.seed, shuffles, mustDraw);
        draw = r.draw; discard = r.discard; shuffles = r.shuffles;
        hands[seat] = hands[seat].concat(r.drawn);
        log = push(log, `${state.players[seat].name} draws ${r.drawn.length} and forfeits the turn.`);
        return { ok: true, state: { ...state, hands, draw, discard, shuffles, mustDraw: 0, justDrew: null, passStreak: 0, turn: advance(0), log } };
      }
      // Normal single draw - stay on turn to decide play/pass.
      const r = drawFrom(draw, discard, state.seed, shuffles, 1);
      draw = r.draw; discard = r.discard; shuffles = r.shuffles;
      if (r.drawn.length === 0) {
        // Nothing to draw and nothing to play - a no-progress pass.
        return endOrPass(state, { ...state, draw, discard, shuffles, justDrew: null }, seat, advance(0), push(log, `${state.players[seat].name} can't move - pass.`));
      }
      hands[seat] = hands[seat].concat(r.drawn);
      justDrew = r.drawn[0];
      log = push(log, `${state.players[seat].name} draws a card.`);
      return { ok: true, state: { ...state, hands, draw, discard, shuffles, justDrew, passStreak: 0, log } };
    }

    if (action.type === "pass") {
      if (!justDrew && this.legalActions(state, actor).some((a) => a.type !== "pass"))
        return { state, ok: false, error: "You can't pass yet." };
      return endOrPass(state, { ...state, justDrew: null }, seat, advance(0), push(log, `${state.players[seat].name} passes.`));
    }

    return { state, ok: false, error: "Unknown action." };
  },

  view(state, viewer): GameView {
    const seat = state.players.findIndex((p) => p.id === viewer);
    const top = state.discard[state.discard.length - 1];
    return {
      type: "crazyeights",
      you: viewer,
      players: state.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: state.hands[i].length,
        isTurn: !state.over && state.turn === i,
        out: state.over && state.winner !== i,
      })),
      turn: state.over ? null : state.players[state.turn].id,
      hand: seat >= 0 ? sortHand(state.hands[seat]) : [],
      legal: this.legalActions(state, viewer),
      center: {
        top,
        currentSuit: state.currentSuit,
        drawCount: state.draw.length,
        dir: state.dir,
        mustDraw: state.mustDraw,
      },
      status: this.status(state),
      log: state.log,
      rules: state.rules,
      aiRules: liveRules(state).map((r) => ({ id: r.id, raw: r.raw, summary: summarizeRule(r) })),
    };
  },

  status(state): GameStatus {
    if (!state.over || state.winner === null) return { over: false, winners: [], losers: [] };
    const w = state.players[state.winner];
    return {
      over: true,
      winners: [w.id],
      losers: state.players.filter((_, i) => i !== state.winner).map((p) => p.id),
      message: `${w.name} wins!`,
    };
  },
};

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r);
}
