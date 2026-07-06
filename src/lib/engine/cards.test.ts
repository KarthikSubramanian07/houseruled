import { describe, it, expect } from "vitest";
import { standardDeck, shuffle, cardId, handTotal, type Card } from "./cards";
import { makeRng } from "./rng";

describe("cards", () => {
  it("builds a 52-card deck with no duplicates", () => {
    const deck = standardDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });

  it("shuffle preserves the multiset and is deterministic per seed", () => {
    const deck = standardDeck();
    const a = shuffle(deck, makeRng(123));
    const b = shuffle(deck, makeRng(123));
    const c = shuffle(deck, makeRng(124));
    expect(a).toEqual(b); // same seed → same order
    expect(a).not.toEqual(deck); // actually shuffled
    expect(new Set(a.map(cardId)).size).toBe(52); // no cards lost
    expect(a).not.toEqual(c); // different seed → different order
  });

  it("handTotal counts aces as 11 or 1 (soft/hard)", () => {
    const A = (s: Card["s"]): Card => ({ r: 1, s });
    const ten = (s: Card["s"]): Card => ({ r: 10, s });
    const six = (s: Card["s"]): Card => ({ r: 6, s });
    expect(handTotal([A("S"), six("H")])).toEqual({ total: 17, soft: true }); // soft 17
    expect(handTotal([A("S"), ten("H")])).toEqual({ total: 21, soft: true }); // blackjack
    expect(handTotal([A("S"), ten("H"), ten("D")])).toEqual({ total: 21, soft: false }); // ace drops to 1
    expect(handTotal([A("S"), A("H"), ten("D")])).toEqual({ total: 12, soft: false }); // both aces low
  });
});
