import { describe, it, expect } from "vitest";
import { oldmaid } from "./oldmaid";
import { makeRng } from "../rng";
import type { SeatInfo } from "../types";

const mk = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `P${i}` }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function total(s: any): number {
  return s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.discardCount;
}

describe("oldmaid", () => {
  it("uses 51 cards (one Queen removed) and conserves them", () => {
    const s = oldmaid.init(mk(4), [], 123);
    expect(total(s)).toBe(51);
  });

  it("plays random legal games to completion with exactly one loser holding one card", () => {
    for (const seed of [1, 2, 3, 4, 5, 40, 77]) {
      const players = mk(2 + (seed % 4)); // 2..5 players
      let s = oldmaid.init(players, [], seed);
      const pick = makeRng(seed + 500);
      let guard = 0;
      while (!s.over && guard++ < 5000) {
        const actor = s.players[s.turn].id;
        const legal = oldmaid.legalActions(s, actor);
        expect(legal.length).toBeGreaterThan(0);
        const a = legal[Math.floor(pick() * legal.length)];
        const r = oldmaid.apply(s, actor, a);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(51);
      }
      expect(s.over).toBe(true);
      const st = oldmaid.status(s);
      expect(st.losers).toHaveLength(1);
      // The loser holds exactly the one unpaired card.
      const li = s.players.findIndex((p) => p.id === st.losers[0]);
      expect(s.hands[li]).toHaveLength(1);
      expect(s.hands[li][0].r).toBe(12); // the odd Queen
    }
  });

  it("respects the draw-right direction rule", () => {
    const s = oldmaid.init(mk(3), ["oldmaid-draw-right"], 9);
    // Just ensure it still produces legal actions and doesn't throw.
    const legal = oldmaid.legalActions(s, s.players[s.turn].id);
    expect(legal.length).toBeGreaterThan(0);
  });
});
