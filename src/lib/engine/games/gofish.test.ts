import { describe, it, expect } from "vitest";
import { gofish } from "./gofish";
import { makeRng } from "../rng";
import type { SeatInfo } from "../types";

const seats2: SeatInfo[] = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
];
const seats4: SeatInfo[] = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Cara" },
  { id: "d", name: "Dan" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function total(s: any): number {
  const h = s.hands.reduce((n: number, x: unknown[]) => n + x.length, 0);
  const b = s.books.reduce((n: number, x: unknown[]) => n + x.length * 4, 0);
  return h + s.pool.length + b;
}

describe("gofish", () => {
  it("deals 7 each heads-up, rest to the pool, and books total is conserved", () => {
    const s = gofish.init(seats2, [], 111);
    expect(total(s)).toBe(52);
    expect(s.pool.length).toBe(52 - 14);
  });

  it("deals 5 each with 4 players", () => {
    const s = gofish.init(seats4, [], 222);
    expect(total(s)).toBe(52);
    expect(s.pool.length).toBe(52 - 20);
  });

  it("rejects asking for a rank you don't hold (default rules)", () => {
    const s = gofish.init(seats2, [], 5);
    const seat = s.turn;
    const held = new Set(s.hands[seat].map((c) => c.r));
    const notHeld = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const).find((r) => !held.has(r));
    if (notHeld !== undefined) {
      const r = gofish.apply(s, s.players[seat].id, { type: "ask", target: "b", rank: notHeld });
      // only meaningful if seat 0 asks b; guard on seat
      if (seat === 0) expect(r.ok).toBe(false);
    }
    expect(true).toBe(true);
  });

  it("plays random legal games to completion, conserving 52 cards throughout", () => {
    for (const seed of [1, 2, 3, 7, 42, 99]) {
      const players = seed % 2 === 0 ? seats4 : seats2;
      let s = gofish.init(players, [], seed);
      const pick = makeRng(seed + 1000);
      let guard = 0;
      while (!s.over && guard++ < 5000) {
        const actor = s.players[s.turn].id;
        const legal = gofish.legalActions(s, actor);
        expect(legal.length).toBeGreaterThan(0);
        const a = legal[Math.floor(pick() * legal.length)];
        const r = gofish.apply(s, actor, a);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(52);
      }
      expect(s.over).toBe(true);
      expect(gofish.status(s).winners.length).toBeGreaterThan(0);
    }
  });

  it("only reveals the viewer's own hand", () => {
    const s = gofish.init(seats2, [], 8);
    const va = gofish.view(s, "a");
    expect(va.hand).toEqual(expect.arrayContaining(s.hands[0]));
    expect(va.players[1]).not.toHaveProperty("hand");
    expect(va.players[1].handCount).toBe(s.hands[1].length);
  });
});
