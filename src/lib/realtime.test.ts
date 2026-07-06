import { describe, it, expect } from "vitest";
import { toSeats } from "./realtime";
import type { PresenceState } from "./types";

const p = (
  id: string,
  joinedAt: number,
  isHost = false,
  name = id.toUpperCase(),
): PresenceState => ({ id, name, isHost, joinedAt });

describe("toSeats", () => {
  it("returns an empty list for no players", () => {
    expect(toSeats([], "self")).toEqual([]);
  });

  it("seats the host first, then everyone else by join order", () => {
    const seats = toSeats([p("p2", 200), p("host", 300, true), p("p1", 100)], "p1");
    expect(seats.map((s) => s.id)).toEqual(["host", "p1", "p2"]);
  });

  it("marks the viewer's own seat", () => {
    const seats = toSeats([p("a", 100), p("b", 200)], "b");
    expect(seats.find((s) => s.id === "b")?.isSelf).toBe(true);
    expect(seats.find((s) => s.id === "a")?.isSelf).toBe(false);
  });

  it("dedupes a player that appears twice (e.g. two tabs), keeping earliest join", () => {
    const seats = toSeats([p("dup", 500), p("dup", 120)], "x");
    expect(seats).toHaveLength(1);
    expect(seats[0].joinedAt).toBe(120);
  });

  it("ignores malformed entries without an id", () => {
    const players = [
      p("good", 100),
      { name: "ghost", isHost: false, joinedAt: 50 } as PresenceState,
    ];
    const seats = toSeats(players, "x");
    expect(seats.map((s) => s.id)).toEqual(["good"]);
  });

  it("carries through name and host flag", () => {
    const [seat] = toSeats([p("h", 10, true, "Dealer")], "x");
    expect(seat.name).toBe("Dealer");
    expect(seat.isHost).toBe(true);
  });
});
