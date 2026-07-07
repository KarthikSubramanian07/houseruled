// Standard playing cards + deck primitives shared by every game.

import type { RNG } from "./rng";

export type Suit = "S" | "H" | "D" | "C";
// 1 = Ace, 11 = Jack, 12 = Queen, 13 = King.
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  s: Suit;
  r: Rank;
  /** The Joker (used only by games with a 43-card deck, e.g. 500). Other fields are placeholders. */
  j?: boolean;
}

/** The single Joker. `s`/`r` are placeholders; identify it with `isJoker`. */
export const JOKER: Card = { s: "S", r: 1, j: true };
export function isJoker(c: Card): boolean {
  return c.j === true;
}

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};
export const RANK_LABEL: Record<Rank, string> = {
  1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K",
};

export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

/** Stable id like "13S" (King of Spades). Unique within a single deck. */
export function cardId(c: Card): string {
  return `${c.r}${c.s}`;
}

export function cardLabel(c: Card): string {
  return c.j ? "Joker" : `${RANK_LABEL[c.r]}${SUIT_SYMBOL[c.s]}`;
}

/** A fresh, ordered 52-card deck. */
export function standardDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ s, r });
  return deck;
}

/** Fisher–Yates shuffle. Returns a NEW array; does not mutate the input. */
export function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Blackjack-style rank value. Face cards = 10, Ace = 11 (soft). Callers downgrade
 * aces to 1 as needed via handTotal().
 */
export function blackjackValue(r: Rank): number {
  if (r === 1) return 11;
  if (r >= 10) return 10;
  return r;
}

/** Best blackjack total for a hand, counting aces as 1 or 11. */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += blackjackValue(c.r);
    if (c.r === 1) aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10; // count an ace as 1 instead of 11
    aces--;
  }
  if (aces === 0) soft = false;
  return { total, soft };
}
