import { describe, it, expect } from "vitest";
import { hearts } from "./hearts";
import { spades } from "./spades";
import { makeRng } from "../rng";
import type { GameDefinition, SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Cara" },
  { id: "d", name: "Dan" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handTotal(s: any): number {
  return s.hands.reduce((n: number, h: unknown[]) => n + h.length, 0) + s.trick.length;
}

// Play a game to completion by choosing a random legal action each turn.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playOut(def: GameDefinition<any>, seed: number, conserve: (s: any) => number) {
  let s = def.init(seats, [], seed);
  const pick = makeRng(seed + 1);
  let guard = 0;
  while (!def.status(s).over && guard++ < 3000) {
    // find whose turn (the player with legal actions)
    const actor = seats.find((p) => def.legalActions(s, p.id).length > 0);
    expect(actor).toBeTruthy();
    const legal = def.legalActions(s, actor!.id);
    const a = legal[Math.floor(pick() * legal.length)];
    const r = def.apply(s, actor!.id, a);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(conserve(s)).toBe(52);
  }
  return s;
}

describe("hearts", () => {
  it("deals 13 each and the 2♣ holder leads", () => {
    const s = hearts.init(seats, [], 3);
    s.hands.forEach((h: unknown[]) => expect(h).toHaveLength(13));
    expect(s.hands[s.leader].some((c) => c.r === 2 && c.s === "C")).toBe(true);
    // Only legal opening play is the 2♣.
    const legal = hearts.legalActions(s, seats[s.leader].id);
    expect(legal).toHaveLength(1);
    expect(legal[0].card).toMatchObject({ r: 2, s: "C" });
  });

  it("plays random legal games to completion, conserving 52 cards", () => {
    for (const seed of [1, 2, 5, 9, 40]) {
      const s = playOut(hearts, seed, (x) => handTotal(x) + x.taken.reduce((n: number, t: unknown[]) => n + t.length, 0));
      expect(s.over).toBe(true);
      expect(s.trickCount).toBe(13);
      const total = s.scores.reduce((n: number, p: number) => n + p, 0);
      expect([26, 78]).toContain(total); // 26 normal, or 78 when someone shoots the moon (26×3)
      expect(hearts.status(s).winners.length).toBeGreaterThan(0);
    }
  });
});

describe("spades", () => {
  it("starts in bidding with 0–13 options for the first bidder", () => {
    const s = spades.init(seats, [], 4);
    expect(s.phase).toBe("bidding");
    expect(spades.legalActions(s, seats[0].id)).toHaveLength(14);
    expect(spades.legalActions(s, seats[1].id)).toHaveLength(0); // not their turn
  });

  it("plays random legal games (bid + 13 tricks) to completion, conserving 52", () => {
    for (const seed of [1, 3, 6, 11, 30]) {
      const s = playOut(spades, seed, (x) => handTotal(x) + x.trickCount * 4);
      expect(s.over).toBe(true);
      expect(s.trickCount).toBe(13);
      const totalTricks = s.tricksWon.reduce((n: number, w: number) => n + w, 0);
      expect(totalTricks).toBe(13);
      expect(spades.status(s).winners.length).toBeGreaterThan(0);
    }
  });
});
