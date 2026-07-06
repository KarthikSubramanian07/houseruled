import { describe, it, expect } from "vitest";
import { crazyeights } from "./crazyeights";
import { makeRng } from "../rng";
import type { Suit } from "../cards";
import type { SeatInfo } from "../types";

const mk = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `P${i}` }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function total(s: any): number {
  return s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.draw.length + s.discard.length;
}

const RULE_SETS = [
  [],
  ["ce8-twos-draw-two"],
  ["ce8-twos-draw-two", "ce8-stack-twos"],
  ["ce8-twos-skip", "ce8-queens-reverse", "ce8-jacks-skip", "ce8-aces-reverse"],
  ["ce8-queens-skip", "ce8-draw-until-play"],
  ["ce8-twos-draw-two", "ce8-stack-twos", "ce8-queens-reverse", "ce8-aces-reverse", "ce8-jacks-skip"],
];

describe("crazyeights", () => {
  it("deals 7 heads-up / 5 multi, one up-card, conserves 52", () => {
    expect(total(crazyeights.init(mk(2), [], 1))).toBe(52);
    expect(total(crazyeights.init(mk(4), [], 1))).toBe(52);
    const s = crazyeights.init(mk(2), [], 1);
    expect(s.hands[0]).toHaveLength(7);
    expect(s.discard).toHaveLength(1);
  });

  it("rejects playing an 8 without declaring a suit", () => {
    let s = crazyeights.init(mk(2), [], 3);
    // Force an 8 into the current player's hand and make it their turn start.
    s = { ...s, hands: [[{ r: 8, s: "H" }], s.hands[1]] };
    const r = crazyeights.apply(s, "a", { type: "play", card: { r: 8, s: "H" } });
    expect(r.ok).toBe(false);
    const r2 = crazyeights.apply(s, "a", { type: "play", card: { r: 8, s: "H" }, suit: "D" });
    expect(r2.ok).toBe(true);
    expect(r2.state.currentSuit).toBe("D");
  });

  it("plays random legal games to completion for every rule set, conserving 52", () => {
    for (const rules of RULE_SETS) {
      for (const seed of [1, 2, 3, 8, 21]) {
        const players = seed % 2 === 0 ? mk(4) : mk(2);
        let s = crazyeights.init(players, rules, seed);
        const pick = makeRng(seed + 7);
        let guard = 0;
        while (!s.over && guard++ < 8000) {
          const actor = s.players[s.turn].id;
          const legal = crazyeights.legalActions(s, actor);
          expect(legal.length).toBeGreaterThan(0); // turn player always has a move
          const a = { ...legal[Math.floor(pick() * legal.length)] };
          // Wild 8s need a declared suit.
          if (a.type === "play" && (a as { wild?: boolean }).wild) {
            (a as { suit?: Suit }).suit = (["S", "H", "D", "C"] as Suit[])[Math.floor(pick() * 4)];
          }
          const r = crazyeights.apply(s, actor, a);
          expect(r.ok).toBe(true);
          s = r.state;
          expect(total(s)).toBe(52);
        }
        expect(s.over).toBe(true);
        expect(crazyeights.status(s).winners.length).toBeGreaterThan(0);
      }
    }
  });

  it("only reveals the viewer's own hand", () => {
    const s = crazyeights.init(mk(3), [], 4);
    const v = crazyeights.view(s, "b");
    expect(v.hand.length).toBe(s.hands[1].length);
    expect(v.players[0]).not.toHaveProperty("hand");
  });
});
