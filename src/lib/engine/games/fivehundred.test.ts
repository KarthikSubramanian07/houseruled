import { describe, it, expect } from "vitest";
import { fivehundred, bidValue, fiveHundredDeck, trickWinner, legalPlays, isTrump } from "./fivehundred";
import { JOKER, type Card } from "../cards";
import { makeRng } from "../rng";
import type { GameDefinition, SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];
const C = (r: number, s: string): Card => ({ r: r as Card["r"], s: s as Card["s"] });

describe("500 deck + schedule", () => {
  it("builds a 43-card deck and the Avondale bid values", () => {
    expect(fiveHundredDeck()).toHaveLength(43);
    expect(bidValue(6, "S")).toBe(40);
    expect(bidValue(6, "NT")).toBe(120);
    expect(bidValue(7, "H")).toBe(200);
    expect(bidValue(10, "NT")).toBe(520);
  });

  it("deals 10 to each of 4 and a 3-card kitty", () => {
    const s = fivehundred.init(seats, [], 1);
    s.hands.forEach((h: Card[]) => expect(h).toHaveLength(10));
    expect(s.kitty).toHaveLength(3);
    expect(s.phase).toBe("bidding");
  });
});

describe("500 bowers + joker", () => {
  it("orders joker > right bower > left bower > ace of trump", () => {
    // Hearts trump; A♥ leads.
    const trick = [
      { seat: 0, card: C(1, "H") }, // A of trump
      { seat: 1, card: C(11, "D") }, // left bower (J of same colour)
      { seat: 2, card: C(11, "H") }, // right bower (J of trump)
      { seat: 3, card: { ...JOKER } }, // joker
    ];
    expect(trickWinner(trick, "H")).toBe(3);
    expect(trickWinner(trick.slice(0, 3), "H")).toBe(2); // right bower beats left + ace
    expect(trickWinner(trick.slice(0, 2), "H")).toBe(1); // left bower beats the ace
  });

  it("treats the left bower as trump for following suit", () => {
    // Hearts trump, a diamond is led. J♦ is the left bower → NOT a diamond.
    const hand = [C(11, "D"), C(9, "D"), C(1, "S")];
    const led = [{ seat: 0, card: C(8, "D") }];
    const plays = legalPlays(hand, led, "H").map((c) => `${c.r}${c.s}`);
    expect(plays).toEqual(["9D"]); // must follow with the real diamond, not the left bower
    expect(isTrump(C(11, "D"), "H")).toBe(true);
  });

  it("makes the joker win in no-trump", () => {
    const trick = [
      { seat: 0, card: { ...JOKER } },
      { seat: 1, card: C(1, "S") },
      { seat: 2, card: C(1, "H") },
      { seat: 3, card: C(1, "D") },
    ];
    expect(trickWinner(trick, "NT")).toBe(0);
  });
});

describe("500 flow", () => {
  it("awards the contract and kitty to the sole remaining bidder", () => {
    let s = fivehundred.init(seats, [], 5);
    // Opening seat bids 6♠, everyone else passes.
    const opener = s.bidTurn;
    s = fivehundred.apply(s, seats[opener].id, { type: "bid", tricks: 6, suit: "S" }).state;
    for (let k = 0; k < 3; k++) {
      const t = s.bidTurn;
      s = fivehundred.apply(s, seats[t].id, { type: "pass" }).state;
    }
    expect(s.phase).toBe("kitty");
    expect(s.declarer).toBe(opener);
    expect(s.hands[opener]).toHaveLength(13); // took the 3-card kitty
  });

  it("plays random legal games to a decided match (±500)", () => {
    for (const seed of [1, 2, 4, 9, 15]) {
      let s = fivehundred.init(seats, [], seed);
      const pick = makeRng(seed + 6);
      let guard = 0;
      while (!s.over && guard++ < 20000) {
        const actor = seats.find((p) => (fivehundred as GameDefinition).legalActions(s, p.id).length > 0);
        expect(actor).toBeTruthy();
        const legal = fivehundred.legalActions(s, actor!.id);
        // Bias bidding so a contract actually gets played instead of endless redeals.
        let choice = legal[Math.floor(pick() * legal.length)];
        if (s.phase === "bidding") {
          const cheap = legal.find((a) => a.type === "bid" && a.tricks === 6);
          if (cheap && pick() < 0.4) choice = cheap;
        }
        const r = fivehundred.apply(s, actor!.id, choice);
        expect(r.ok).toBe(true);
        s = r.state;
        if (s.phase === "playing") expect(s.trick.length).toBeLessThan(4);
      }
      expect(s.over).toBe(true);
      expect(Math.max(s.teamScores[0], s.teamScores[1]) >= 500 || Math.min(s.teamScores[0], s.teamScores[1]) <= -500).toBe(true);
      expect(fivehundred.status(s).winners.length).toBe(2);
    }
  });
});
