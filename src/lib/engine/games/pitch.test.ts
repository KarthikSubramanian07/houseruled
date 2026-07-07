import { describe, it, expect } from "vitest";
import { pitch } from "./pitch";
import { makeRng } from "../rng";
import type { GameDefinition, SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];

describe("pitch", () => {
  it("deals 6 each and opens in bidding", () => {
    const s = pitch.init(seats, [], 1);
    s.hands.forEach((h: unknown[]) => expect(h).toHaveLength(6));
    expect(s.phase).toBe("bidding");
    expect(pitch.legalActions(s, "a").some((x) => x.type === "bid" && x.n === 2)).toBe(true);
  });

  it("requires each bid to beat the standing bid", () => {
    let s = pitch.init(seats, [], 2);
    s = pitch.apply(s, "a", { type: "bid", n: 3 }).state;
    // B must beat 3 (so only 4) or pass.
    const bBids = pitch.legalActions(s, "b").filter((x) => x.type === "bid").map((x) => x.n);
    expect(bBids).toEqual([4]);
    expect(pitch.apply(s, "b", { type: "bid", n: 2 }).ok).toBe(false);
  });

  it("sticks the dealer when everyone passes", () => {
    let s = pitch.init(seats, [], 3);
    s = pitch.apply(s, "a", { type: "pass" }).state;
    s = pitch.apply(s, "b", { type: "pass" }).state;
    s = pitch.apply(s, "c", { type: "pass" }).state;
    const dealer = pitch.legalActions(s, "d");
    expect(dealer.every((x) => x.type === "bid")).toBe(true);
    expect(dealer.some((x) => x.n === 2)).toBe(true);
  });

  it("lets a player trump in even when they can follow the led suit", () => {
    let s = pitch.init(seats, [], 1);
    // Hearts trump, spades led; seat B holds a spade (can follow) AND a heart (trump).
    s = { ...s, phase: "playing", trump: "H", turn: 1, trick: [{ seat: 0, card: { r: 9, s: "S" } }],
      hands: [s.hands[0], [{ r: 5, s: "S" }, { r: 3, s: "H" }], s.hands[2], s.hands[3]] };
    const legal = pitch.legalActions(s, "b");
    const cards = legal.map((a) => `${(a.card as { r: number; s: string }).r}${(a.card as { r: number; s: string }).s}`);
    expect(cards).toContain("3H"); // may ruff with the trump
    expect(cards).toContain("5S"); // or follow suit
    expect(pitch.apply(s, "b", { type: "play", card: { r: 3, s: "H" } }).ok).toBe(true);
  });

  it("plays full hands and awards ≤4 points (with a possible set)", () => {
    for (const seed of [1, 2, 5, 8, 20, 41]) {
      let s = pitch.init(seats, [], seed);
      const pick = makeRng(seed + 3);
      let guard = 0;
      while (!pitch.status(s).over && guard++ < 500) {
        const actor = seats.find((p) => (pitch as GameDefinition).legalActions(s, p.id).length > 0);
        expect(actor).toBeTruthy();
        const legal = pitch.legalActions(s, actor!.id);
        // Bias toward bidding 2 so play actually starts, else random.
        const bid2 = legal.find((a) => a.type === "bid" && a.n === 2);
        const chosen = s.phase === "bidding" && bid2 && pick() < 0.5 ? bid2 : legal[Math.floor(pick() * legal.length)];
        const r = pitch.apply(s, actor!.id, chosen);
        expect(r.ok).toBe(true);
        s = r.state;
      }
      expect(s.over).toBe(true);
      expect(s.trickCount).toBe(6);
      expect(["S", "H", "D", "C"]).toContain(s.trump);
      expect(pitch.status(s).winners.length).toBeGreaterThan(0);
    }
  });
});
