// Shared trick-taking helpers (Hearts, Spades, and future Euchre/Whist/Bridge).

import type { Card, Suit } from "../cards";

export interface PlayedCard {
  seat: number;
  card: Card;
}

export function cardsOfSuit(hand: Card[], suit: Suit): Card[] {
  return hand.filter((c) => c.s === suit);
}

/** Higher rank wins; Ace (1) is high in trick games. */
export function trickRank(r: number): number {
  return r === 1 ? 14 : r;
}

/**
 * Index into `played` of the winning card: the highest trump if any trump was
 * played, otherwise the highest card of the led suit. `played[0]` set the led suit.
 */
export function trickWinner(played: PlayedCard[], trump?: Suit): number {
  if (played.length === 0) return -1;
  const led = played[0].card.s;
  let best = 0;
  for (let i = 1; i < played.length; i++) {
    const c = played[i].card;
    const b = played[best].card;
    const cTrump = trump && c.s === trump;
    const bTrump = trump && b.s === trump;
    if (cTrump && !bTrump) best = i;
    else if (cTrump === bTrump) {
      // same trump status → compare within the relevant suit
      const relevant = bTrump ? trump : led;
      if (c.s === relevant && (b.s !== relevant || trickRank(c.r) > trickRank(b.r))) best = i;
    }
  }
  return best;
}

/** Standard follow-suit: must follow the led suit if you hold it; else anything. */
export function followSuit(hand: Card[], ledSuit: Suit | null): Card[] {
  if (!ledSuit) return hand.slice();
  const inSuit = cardsOfSuit(hand, ledSuit);
  return inSuit.length > 0 ? inSuit : hand.slice();
}
