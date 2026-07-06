// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getPlayer } from "./identity";

describe("getPlayer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates an id and a name on first call", () => {
    const player = getPlayer();
    expect(player.id.length).toBeGreaterThan(0);
    expect(player.name.length).toBeGreaterThan(0);
  });

  it("persists identity across calls (same id and name)", () => {
    const first = getPlayer();
    const second = getPlayer();
    expect(second.id).toBe(first.id);
    expect(second.name).toBe(first.name);
  });

  it("writes id and name to localStorage", () => {
    const player = getPlayer();
    expect(window.localStorage.getItem("houseruled.player.id")).toBe(player.id);
    expect(window.localStorage.getItem("houseruled.player.name")).toBe(player.name);
  });

  it("gives different browsers different ids", () => {
    const a = getPlayer().id;
    window.localStorage.clear();
    const b = getPlayer().id;
    expect(a).not.toBe(b);
  });
});
