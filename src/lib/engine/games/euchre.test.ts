import { describe, it, expect } from "vitest";
import { euchre } from "./euchre";
import { makeRng } from "../rng";
import type { GameDefinition, SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];

// Drive a full hand with random legal choices.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playOut(seed: number): any {
  let s = euchre.init(seats, [], seed);
  const pick = makeRng(seed + 1);
  let guard = 0;
  while (!euchre.status(s).over && guard++ < 2000) {
    const actor = seats.find((p) => (euchre as GameDefinition).legalActions(s, p.id).length > 0);
    expect(actor).toBeTruthy();
    const legal = euchre.legalActions(s, actor!.id);
    const a = legal[Math.floor(pick() * legal.length)];
    const r = euchre.apply(s, actor!.id, a);
    expect(r.ok).toBe(true);
    s = r.state;
  }
  return s;
}

describe("euchre", () => {
  it("uses a 24-card deck: 5 each + a 4-card kitty", () => {
    const s = euchre.init(seats, [], 1);
    const total = s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.kitty.length;
    expect(total).toBe(24);
    s.hands.forEach((h: unknown[]) => expect(h).toHaveLength(5));
    expect(s.kitty).toHaveLength(4);
    expect(s.phase).toBe("bid1");
  });

  it("opens with order-up / pass for the first bidder only", () => {
    const s = euchre.init(seats, [], 2);
    expect(euchre.legalActions(s, "a").map((x) => x.type).sort()).toEqual(["orderup", "pass"]);
    expect(euchre.legalActions(s, "b")).toHaveLength(0);
  });

  it("sticks the dealer: if all pass twice, the dealer must call (no pass)", () => {
    let s = euchre.init(seats, [], 5);
    // Everyone passes round 1.
    for (const id of ["a", "b", "c", "d"]) s = euchre.apply(s, id, { type: "pass" }).state;
    expect(s.phase).toBe("bid2");
    // Pass round 2 up to the dealer (seat 3 = "d").
    s = euchre.apply(s, "a", { type: "pass" }).state;
    s = euchre.apply(s, "b", { type: "pass" }).state;
    s = euchre.apply(s, "c", { type: "pass" }).state;
    // Dealer is stuck — only calls, no pass.
    const dealerLegal = euchre.legalActions(s, "d");
    expect(dealerLegal.every((x) => x.type === "call")).toBe(true);
    expect(euchre.apply(s, "d", { type: "pass" }).ok).toBe(false);
  });

  it("plays full hands to completion and scores a single team", () => {
    for (const seed of [1, 2, 3, 7, 12, 44]) {
      const s = playOut(seed);
      expect(s.over).toBe(true);
      expect(s.trickCount).toBe(5);
      expect(s.tricksWon[0] + s.tricksWon[1]).toBe(5);
      // Exactly one team scores, and it's a legal euchre score.
      const scored = s.scores.filter((x: number) => x > 0);
      expect(scored).toHaveLength(1);
      expect([1, 2]).toContain(scored[0]);
      expect(euchre.status(s).winners).toHaveLength(2); // a partnership
    }
  });
});
