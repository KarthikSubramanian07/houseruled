import { describe, it, expect } from "vitest";
import { casino } from "./casino";
import { makeRng } from "../rng";
import type { SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const total = (s: any) =>
  s.hands[0].length + s.hands[1].length + s.table.length + s.deck.length + s.captured[0].length + s.captured[1].length;

describe("casino", () => {
  it("deals 4 each, 4 to the table, and 52 cards are accounted for", () => {
    const s = casino.init(seats, [], 1);
    expect(s.hands[0]).toHaveLength(4);
    expect(s.hands[1]).toHaveLength(4);
    expect(s.table).toHaveLength(4);
    expect(s.deck).toHaveLength(40);
    expect(total(s)).toBe(52);
    // Non-dealer (seat 0) leads.
    expect(casino.legalActions(s, "a").length).toBeGreaterThan(0);
    expect(casino.legalActions(s, "b")).toHaveLength(0);
  });

  it("captures a matching rank (pairing) and a summing set", () => {
    let s = casino.init(seats, [], 2);
    // Force a known layout: table has 9♣, 4♦, 5♥; play 9♠ → pairs the 9, sums 4+5.
    s = { ...s, turn: 0, table: [{ r: 9, s: "C" }, { r: 4, s: "D" }, { r: 5, s: "H" }], hands: [[{ r: 9, s: "S" }], s.hands[1]] };
    const r = casino.apply(s, "a", { type: "capture", card: { r: 9, s: "S" }, targets: [{ r: 9, s: "C" }, { r: 4, s: "D" }, { r: 5, s: "H" }] });
    expect(r.ok).toBe(true);
    // 3 table cards + the played card.
    expect(r.state.captured[0]).toHaveLength(4);
    expect(r.state.table).toHaveLength(0);
    expect(r.state.sweeps[0]).toBe(1); // cleared the table
  });

  it("rejects a capture set that neither pairs nor sums to the card", () => {
    let s = casino.init(seats, [], 4);
    s = { ...s, turn: 0, table: [{ r: 9, s: "C" }, { r: 3, s: "D" }], hands: [[{ r: 5, s: "S" }], s.hands[1]] };
    const r = casino.apply(s, "a", { type: "capture", card: { r: 5, s: "S" }, targets: [{ r: 9, s: "C" }] });
    expect(r.ok).toBe(false);
  });

  it("rejects a capture that lists the same table card twice (no phantom cards)", () => {
    let s = casino.init(seats, [], 8);
    // One 5♦ on the table; a malicious client claims to capture it twice with a 10.
    s = { ...s, turn: 0, table: [{ r: 5, s: "D" }], hands: [[{ r: 10, s: "S" }], s.hands[1]] };
    const r = casino.apply(s, "a", { type: "capture", card: { r: 10, s: "S" }, targets: [{ r: 5, s: "D" }, { r: 5, s: "D" }] });
    expect(r.ok).toBe(false);
  });

  it("trails a card face-up when you don't capture", () => {
    let s = casino.init(seats, [], 6);
    const before = s.table.length;
    const card = s.hands[0][0];
    const r = casino.apply(s, "a", { type: "trail", card });
    expect(r.ok).toBe(true);
    expect(r.state.table.length).toBe(before + 1);
    expect(r.state.turn).toBe(1);
  });

  it("plays random legal games to a decided match, conserving 52 cards", () => {
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      let s = casino.init(seats, [], seed);
      const pick = makeRng(seed + 17);
      let guard = 0;
      while (!s.over && guard++ < 3000) {
        const id = s.players[s.turn].id;
        const legal = casino.legalActions(s, id);
        expect(legal.length).toBeGreaterThan(0);
        const r = casino.apply(s, id, legal[Math.floor(pick() * legal.length)]);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(total(s)).toBe(52);
      }
      expect(s.over).toBe(true);
      expect(Math.max(s.total[0], s.total[1])).toBeGreaterThanOrEqual(21);
      expect(s.total[0]).not.toBe(s.total[1]);
      expect(casino.status(s).winners.length).toBe(1);
    }
  });
});
