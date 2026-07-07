import { describe, it, expect } from "vitest";
import { ohhell } from "./ohhell";
import { makeRng } from "../rng";
import type { GameDefinition, SeatInfo } from "../types";

const mk = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `P${i}` }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dealt = (s: any) =>
  s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.trick.length + s.trickCount * s.players.length;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playOut(n: number, seed: number): any {
  let s = ohhell.init(mk(n), [], seed);
  const pick = makeRng(seed + 1);
  let guard = 0;
  const size = 8 * n;
  while (!ohhell.status(s).over && guard++ < 3000) {
    const actor = mk(n).find((p) => (ohhell as GameDefinition).legalActions(s, p.id).length > 0);
    expect(actor).toBeTruthy();
    const legal = ohhell.legalActions(s, actor!.id);
    const a = legal[Math.floor(pick() * legal.length)];
    const r = ohhell.apply(s, actor!.id, a);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(dealt(s)).toBe(size);
  }
  return s;
}

describe("ohhell", () => {
  it("deals 8 each and turns a trump", () => {
    const s = ohhell.init(mk(4), [], 1);
    s.hands.forEach((h: unknown[]) => expect(h).toHaveLength(8));
    expect(["S", "H", "D", "C"]).toContain(s.trump);
    expect(s.phase).toBe("bidding");
  });

  it("screws the dealer: their bid can't make the total equal the hand size", () => {
    let s = ohhell.init(mk(4), [], 2);
    s = ohhell.apply(s, "a", { type: "bid", n: 2 }).state;
    s = ohhell.apply(s, "b", { type: "bid", n: 2 }).state;
    s = ohhell.apply(s, "c", { type: "bid", n: 2 }).state; // others total 6
    const dealerBids = ohhell.legalActions(s, "d").map((x) => x.n);
    expect(dealerBids).not.toContain(2); // 8 - 6 = 2 is forbidden
    expect(ohhell.apply(s, "d", { type: "bid", n: 2 }).ok).toBe(false);
    expect(ohhell.apply(s, "d", { type: "bid", n: 3 }).ok).toBe(true);
  });

  it("plays full hands to completion with correct scoring", () => {
    for (const n of [3, 4, 5]) {
      for (const seed of [1, 4, 9]) {
        const s = playOut(n, seed);
        expect(s.over).toBe(true);
        expect(s.trickCount).toBe(8);
        expect(s.tricksWon.reduce((a: number, b: number) => a + b, 0)).toBe(8);
        // Score matches the rule: exact bid → 10+won, else −|won−bid|.
        s.players.forEach((_: unknown, i: number) => {
          const expected = s.tricksWon[i] === s.bids[i] ? 10 + s.tricksWon[i] : -Math.abs(s.tricksWon[i] - s.bids[i]);
          expect(s.scores[i]).toBe(expected);
        });
        expect(ohhell.status(s).winners.length).toBeGreaterThan(0);
      }
    }
  });
});
