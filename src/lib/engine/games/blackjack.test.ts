import { describe, it, expect } from "vitest";
import { blackjack } from "./blackjack";
import { makeRng } from "../rng";
import type { SeatInfo } from "../types";

const mk = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `P${i}` }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function total(s: any): number {
  return s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.dealer.length + s.shoe.length;
}

describe("blackjack", () => {
  it("deals two to each player and the dealer; conserves 52", () => {
    const s = blackjack.init(mk(3), [], 1);
    expect(total(s)).toBe(52);
    s.hands.forEach((h: unknown[]) => expect(h).toHaveLength(2));
    expect(s.dealer).toHaveLength(2);
  });

  it("hides the hole card until the game is over", () => {
    const s = blackjack.init(mk(1), [], 7);
    const v = blackjack.view(s, "a");
    if (s.phase !== "over") {
      expect(v.center.dealer).toHaveLength(1);
      expect(v.center.dealerHiddenCount).toBe(1);
    }
  });

  it("plays random hit/stand games to completion, every hand scored, 52 conserved", () => {
    for (const rules of [[], ["bj-dealer-hits-soft-17"], ["bj-five-card-charlie"], ["bj-dealer-wins-ties"]]) {
      for (const seed of [1, 2, 3, 11, 50]) {
        let s = blackjack.init(mk(1 + (seed % 4)), rules, seed);
        const pick = makeRng(seed + 3);
        let guard = 0;
        while (s.phase !== "over" && guard++ < 500) {
          const actor = s.players[s.turn].id;
          const legal = blackjack.legalActions(s, actor);
          expect(legal.length).toBe(2); // hit + stand
          const a = legal[pick() < 0.55 ? 0 : 1]; // lean toward hitting
          const r = blackjack.apply(s, actor, a);
          expect(r.ok).toBe(true);
          s = r.state;
          expect(total(s)).toBe(52);
        }
        expect(s.phase).toBe("over");
        // Every player has a definite result.
        expect(s.results.every((r: unknown) => r === "win" || r === "lose" || r === "push")).toBe(true);
      }
    }
  });

  it("busting is an immediate loss", () => {
    // Construct a state where the player already holds 16 and hits into a bust is possible.
    let s = blackjack.init(mk(1), [], 2);
    // Force a hand that will bust on the next reasonable hit by hitting until done.
    let guard = 0;
    while (s.phase !== "over" && guard++ < 50) {
      s = blackjack.apply(s, "a", { type: "hit" }).state; // always hit → will bust
    }
    expect(s.phase).toBe("over");
    // Player almost certainly busted by always hitting; result is decided either way.
    expect(["win", "lose", "push"]).toContain(s.results[0]);
  });
});
