import { describe, it, expect } from "vitest";
import { cribbage, showScore, pegScore } from "./cribbage";
import { makeRng } from "../rng";
import type { Card } from "../cards";
import type { GameDefinition, SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
const C = (r: number, s: string): Card => ({ r: r as Card["r"], s: s as Card["s"] });

describe("cribbage scoring", () => {
  it("scores the famous 29 hand", () => {
    // Three fives + jack, cut the matching-suit five.
    const { pts } = showScore([C(5, "H"), C(5, "S"), C(5, "D"), C(11, "C")], C(5, "C"), false);
    expect(pts).toBe(29);
  });

  it("scores 15s, a run, and a pair together", () => {
    // 4,5,6 (run of 3) + 5 (pair of 5s) + starter 10: 15s = 5+10, 4+5+6, 5+10 → and a double run.
    const { pts } = showScore([C(4, "H"), C(5, "S"), C(5, "D"), C(6, "C")], C(10, "H"), false);
    // 15s: (5+10)×2 + (4+5+6) = 3 fifteens = 6; pair of 5s = 2; double run of 3 = 8. Total 16.
    expect(pts).toBe(16);
  });

  it("counts a 4-card flush in hand but not in the crib", () => {
    const hand = [C(2, "H"), C(5, "H"), C(9, "H"), C(13, "H")];
    expect(showScore(hand, C(7, "S"), false).pts).toBeGreaterThanOrEqual(4);
    expect(showScore(hand, C(7, "S"), false).notes).toContain("flush 4");
    expect(showScore(hand, C(7, "S"), true).notes).not.toContain("flush 4");
  });

  it("pegs 15, pairs, and runs during the play", () => {
    expect(pegScore([{ seat: 0, card: C(7, "H") }, { seat: 1, card: C(8, "S") }], 15).pts).toBe(2);
    expect(pegScore([{ seat: 0, card: C(6, "H") }, { seat: 1, card: C(6, "S") }], 12).notes).toContain("pair");
    expect(pegScore([{ seat: 0, card: C(3, "H") }, { seat: 1, card: C(4, "S") }, { seat: 0, card: C(5, "D") }], 12).notes).toContain("run of 3");
  });
});

describe("cribbage flow", () => {
  it("deals 6 each and opens in discard for both players", () => {
    const s = cribbage.init(seats, [], 1);
    expect(s.hands[0]).toHaveLength(6);
    expect(s.hands[1]).toHaveLength(6);
    expect(s.phase).toBe("discard");
    expect(cribbage.legalActions(s, "a").length).toBe(15); // C(6,2)
    expect(cribbage.legalActions(s, "b").length).toBe(15);
  });

  it("fills the crib and cuts a starter once both discard", () => {
    let s = cribbage.init(seats, [], 2);
    s = cribbage.apply(s, "a", cribbage.legalActions(s, "a")[0]).state;
    s = cribbage.apply(s, "b", cribbage.legalActions(s, "b")[0]).state;
    expect(s.phase).toBe("play");
    expect(s.crib).toHaveLength(4);
    expect(s.starter).not.toBeNull();
    expect(s.hands[0]).toHaveLength(4);
  });

  it("plays random legal games to 121 without ever passing 31", () => {
    for (const seed of [1, 3, 7, 12, 25]) {
      let s = cribbage.init(seats, [], seed);
      const pick = makeRng(seed + 4);
      let guard = 0;
      while (!s.over && guard++ < 8000) {
        const actor = seats.find((p) => (cribbage as GameDefinition).legalActions(s, p.id).length > 0);
        expect(actor).toBeTruthy();
        const legal = cribbage.legalActions(s, actor!.id);
        const r = cribbage.apply(s, actor!.id, legal[Math.floor(pick() * legal.length)]);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(s.count).toBeLessThanOrEqual(31);
      }
      expect(s.over).toBe(true);
      expect(Math.max(s.scores[0], s.scores[1])).toBe(121);
      expect(cribbage.status(s).winners).toHaveLength(1);
    }
  });
});
