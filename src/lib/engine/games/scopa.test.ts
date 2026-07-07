import { describe, it, expect } from "vitest";
import { scopa } from "./scopa";
import { makeRng } from "../rng";
import type { SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const total = (s: any) =>
  s.hands[0].length + s.hands[1].length + s.table.length + s.deck.length + s.captured[0].length + s.captured[1].length;

describe("scopa", () => {
  it("uses a 40-card deck: 3+3 hands, 4 on the table, rest in the deck", () => {
    const s = scopa.init(seats, [], 1);
    expect(total(s)).toBe(40);
    expect(s.hands[0]).toHaveLength(3);
    expect(s.table).toHaveLength(4);
    expect(s.deck).toHaveLength(30);
  });

  it("captures a single equal-value card", () => {
    let s = scopa.init(seats, [], 2);
    s = { ...s, turn: 0, table: [{ r: 5, s: "H" }, { r: 3, s: "C" }], hands: [[{ r: 5, s: "S" }], s.hands[1]] };
    const r = scopa.apply(s, "a", { type: "play", card: { r: 5, s: "S" } });
    expect(r.ok).toBe(true);
    expect(r.state.captured[0]).toHaveLength(2); // the 5♥ + the played 5♠
    expect(r.state.table.some((c) => c.r === 5)).toBe(false);
  });

  it("captures a summing set and scores a scopa on a sweep", () => {
    let s = scopa.init(seats, [], 3);
    // table sums to 7 exactly (3+4); playing a 7 sweeps → scopa.
    s = { ...s, turn: 0, deck: [{ r: 2, s: "C" }, { r: 2, s: "H" }, { r: 6, s: "C" }, { r: 6, s: "H" }, { r: 6, s: "D" }, { r: 6, s: "S" }], table: [{ r: 3, s: "H" }, { r: 4, s: "C" }], hands: [[{ r: 7, s: "S" }], [{ r: 9, s: "S" }]] };
    const r = scopa.apply(s, "a", { type: "play", card: { r: 7, s: "S" } });
    expect(r.ok).toBe(true);
    expect(r.state.captured[0]).toHaveLength(3);
    expect(r.state.scope[0]).toBe(1); // swept the table with cards left to play
  });

  it("plays random legal games to completion, conserving 40 cards", () => {
    for (const seed of [1, 2, 4, 7, 11]) {
      let s = scopa.init(seats, [], seed);
      const pick = makeRng(seed + 9);
      let guard = 0;
      while (!s.over && guard++ < 400) {
        const id = s.players[s.turn].id;
        const legal = scopa.legalActions(s, id);
        expect(legal.length).toBeGreaterThan(0);
        const r = scopa.apply(s, id, legal[Math.floor(pick() * legal.length)]);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(40);
      }
      expect(s.over).toBe(true);
      // Every card ends up captured at game end.
      expect(s.captured[0].length + s.captured[1].length).toBe(40);
    }
  });
});
