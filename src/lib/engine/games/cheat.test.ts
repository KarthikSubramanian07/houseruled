import { describe, it, expect } from "vitest";
import { cheat } from "./cheat";
import type { Card } from "../cards";
import type { SeatInfo } from "../types";

const seats = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `P${i}` }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const total = (s: any) => s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.pile.length;

describe("cheat (bluff)", () => {
  it("deals the whole deck and starts on Aces", () => {
    const s = cheat.init(seats(4), [], 1);
    expect(total(s)).toBe(52);
    expect(s.pile).toHaveLength(0);
    expect(cheat.view(s, "a").center.requiredRank).toBe("A");
  });

  it("catches a bluff: the liar eats the pile", () => {
    let s = cheat.init(seats(2), [], 2);
    // Force a known hand and play a lie (claim Aces with a 5).
    s = { ...s, turn: 0, rankIdx: 0, hands: [[{ r: 5, s: "H" }, { r: 9, s: "C" }], s.hands[1]] };
    const r1 = cheat.apply(s, "a", { type: "play", cards: [{ r: 5, s: "H" }] });
    expect(r1.ok).toBe(true);
    expect(r1.state.pile).toHaveLength(1);
    // P1 calls the bluff → P0 (liar) takes the pile.
    const r2 = cheat.apply(r1.state, "b", { type: "call" });
    expect(r2.ok).toBe(true);
    expect(r2.state.hands[0].some((c: Card) => c.r === 5 && c.s === "H")).toBe(true); // liar got it back
    expect(r2.state.pile).toHaveLength(0);
  });

  it("punishes a wrong call: the doubter eats the pile", () => {
    let s = cheat.init(seats(2), [], 3);
    s = { ...s, turn: 0, rankIdx: 0, hands: [[{ r: 1, s: "H" }, { r: 9, s: "C" }], s.hands[1]] };
    const r1 = cheat.apply(s, "a", { type: "play", cards: [{ r: 1, s: "H" }] }); // honest Ace
    const r2 = cheat.apply(r1.state, "b", { type: "call" });
    expect(r2.ok).toBe(true);
    // P1 wrongly doubted → P1 takes the pile.
    expect(r2.state.hands[1].some((c: Card) => c.r === 1 && c.s === "H")).toBe(true);
  });

  it("plays out (each bot plays one card, nobody calls) to a winner, conserving 52", () => {
    for (const n of [2, 3, 4]) {
      let s = cheat.init(seats(n), [], n * 10 + 1);
      let guard = 0;
      while (!s.over && guard++ < 500) {
        const seat = s.turn;
        const id = s.players[seat].id;
        const legal = cheat.legalActions(s, id);
        expect(legal.length).toBeGreaterThan(0);
        // Always play one card (never call) → someone empties, next play wins them.
        const r = cheat.apply(s, id, { type: "play", cards: [s.hands[seat][0]] });
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(52);
      }
      expect(s.over).toBe(true);
      expect(cheat.status(s).winners).toHaveLength(1);
    }
  });
});
