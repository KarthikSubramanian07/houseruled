import { describe, it, expect } from "vitest";
import { gin, bestMelds } from "./gin";
import { makeRng } from "../rng";
import type { Card } from "../cards";
import type { SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "Ann" },
  { id: "b", name: "Bo" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const total = (s: any) => s.hands[0].length + s.hands[1].length + s.stock.length + s.discard.length;

describe("bestMelds", () => {
  it("finds a full gin hand (0 deadwood)", () => {
    const hand: Card[] = [
      { r: 3, s: "S" }, { r: 4, s: "S" }, { r: 5, s: "S" }, // run
      { r: 7, s: "H" }, { r: 8, s: "H" }, { r: 9, s: "H" }, // run
      { r: 13, s: "S" }, { r: 13, s: "H" }, { r: 13, s: "D" }, { r: 13, s: "C" }, // set of 4
    ];
    const r = bestMelds(hand);
    expect(r.value).toBe(0);
    expect(r.deadwood).toHaveLength(0);
    expect(r.melds).toHaveLength(3);
  });

  it("computes deadwood value for an unmelded remainder", () => {
    const hand: Card[] = [
      { r: 2, s: "S" }, { r: 3, s: "S" }, { r: 4, s: "S" }, // run (melded)
      { r: 10, s: "H" }, { r: 10, s: "D" }, // pair, not a meld
      { r: 13, s: "C" }, { r: 5, s: "C" }, { r: 8, s: "D" }, { r: 2, s: "H" }, { r: 9, s: "S" },
    ];
    const r = bestMelds(hand);
    // deadwood: 10 + 10 + 10(K) + 5 + 8 + 2 + 9 = 54
    expect(r.value).toBe(54);
    expect(r.deadwood).toHaveLength(7);
  });

  it("prefers the partition with less deadwood", () => {
    // 4-5-6-7 of spades: best is a 4-run (0 deadwood), not 3-run + leftover.
    const hand: Card[] = [
      { r: 4, s: "S" }, { r: 5, s: "S" }, { r: 6, s: "S" }, { r: 7, s: "S" },
      { r: 9, s: "H" }, { r: 9, s: "D" }, { r: 9, s: "C" }, // set
      { r: 1, s: "H" }, { r: 2, s: "H" }, { r: 3, s: "H" }, // run
    ];
    expect(bestMelds(hand).value).toBe(0);
  });
});

describe("gin game", () => {
  it("deals 10 each, 1 up-card, rest to stock (52 conserved)", () => {
    const s = gin.init(seats, [], 1);
    expect(s.hands[0]).toHaveLength(10);
    expect(s.hands[1]).toHaveLength(10);
    expect(s.discard).toHaveLength(1);
    expect(total(s)).toBe(52);
  });

  it("plays out (draw/discard, knock when able) to a result, conserving 52", () => {
    for (const seed of [1, 2, 5, 8, 13, 21]) {
      let s = gin.init(seats, [], seed);
      let guard = 0;
      while (!s.over && guard++ < 400) {
        const id = s.players[s.turn].id;
        const legal = gin.legalActions(s, id);
        expect(legal.length).toBeGreaterThan(0);
        // Prefer gin > knock > plain discard (first) to drive termination.
        const gg = legal.find((a) => a.type === "gin");
        const kk = legal.find((a) => a.type === "knock");
        const draw = legal.find((a) => a.type === "drawStock");
        const chosen = draw ?? gg ?? kk ?? legal.find((a) => a.type === "discard")!;
        const r = gin.apply(s, id, chosen);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(52);
      }
      expect(s.over).toBe(true);
      expect(typeof s.outcome).toBe("string");
    }
  });
});
