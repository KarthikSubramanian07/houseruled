import { describe, it, expect } from "vitest";
import { war } from "./war";
import type { SeatInfo } from "../types";

const seats: SeatInfo[] = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function count(state: any): number {
  return state.stacks[0].length + state.stacks[1].length;
}

describe("war", () => {
  it("deals 26/26 and starts on seat 0", () => {
    const s = war.init(seats, [], 12345);
    expect(count(s)).toBe(52);
    expect(s.stacks[0]).toHaveLength(26);
    expect(s.stacks[1]).toHaveLength(26);
    expect(s.over).toBe(false);
    expect(war.legalActions(s, "a")).toEqual([{ type: "flip" }]);
    expect(war.legalActions(s, "b")).toEqual([]); // not their turn
  });

  it("rejects a flip from the wrong player", () => {
    const s = war.init(seats, [], 1);
    const r = war.apply(s, "b", { type: "flip" });
    expect(r.ok).toBe(false);
  });

  it("conserves all 52 cards on every flip and terminates with one winner", () => {
    let s = war.init(seats, [], 987654);
    let guard = 0;
    while (!s.over && guard++ < 20000) {
      const actor = s.players[s.turn].id;
      const r = war.apply(s, actor, { type: "flip" });
      expect(r.ok).toBe(true);
      s = r.state;
      expect(count(s)).toBe(52); // never lose or duplicate a card
    }
    expect(s.over).toBe(true);
    const st = war.status(s);
    expect(st.winners).toHaveLength(1);
    expect(st.losers).toHaveLength(1);
    // Winner holds the whole deck.
    const wi = s.players.findIndex((p) => p.id === st.winners[0]);
    expect(s.stacks[wi]).toHaveLength(52);
  });

  it("view never leaks cards (no hand) and reports stack counts", () => {
    const s = war.init(seats, [], 42);
    const v = war.view(s, "a");
    expect(v.hand).toEqual([]);
    expect(v.players[0].handCount).toBe(26);
    expect(v.players[1].handCount).toBe(26);
  });

  it("honors the war-one-card house rule (still terminates, still conserves)", () => {
    let s = war.init(seats, ["war-one-card"], 55);
    let guard = 0;
    while (!s.over && guard++ < 20000) {
      s = war.apply(s, s.players[s.turn].id, { type: "flip" }).state;
      expect(count(s)).toBe(52);
    }
    expect(s.over).toBe(true);
  });
});
