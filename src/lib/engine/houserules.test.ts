import { describe, it, expect } from "vitest";
import { rulesFor, detectConflicts, sanitizeRules, getRule } from "./houserules";

describe("house rules", () => {
  it("offers a rich toggle set for Crazy Eights and some for every game", () => {
    expect(rulesFor("crazyeights").length).toBeGreaterThanOrEqual(8);
    for (const g of ["war", "gofish", "oldmaid", "crazyeights", "blackjack"]) {
      expect(rulesFor(g).length).toBeGreaterThan(0);
      rulesFor(g).forEach((r) => expect(r.game).toBe(g));
    }
  });

  it("flags mutually-exclusive rules in the same group", () => {
    const c = detectConflicts("crazyeights", ["ce8-twos-draw-two", "ce8-twos-skip"]);
    expect(c).toHaveLength(1);
    expect(c[0].ids.sort()).toEqual(["ce8-twos-draw-two", "ce8-twos-skip"]);

    expect(detectConflicts("crazyeights", ["ce8-queens-skip", "ce8-queens-reverse"])).toHaveLength(1);
    expect(detectConflicts("crazyeights", ["ce8-aces-reverse", "ce8-aces-skip"])).toHaveLength(1);
  });

  it("allows compatible combinations", () => {
    const ok = ["ce8-twos-draw-two", "ce8-queens-reverse", "ce8-jacks-skip", "ce8-aces-skip"];
    expect(detectConflicts("crazyeights", ok)).toHaveLength(0);
  });

  it("flags an unmet dependency (stacking needs draw-two)", () => {
    const c = detectConflicts("crazyeights", ["ce8-stack-twos"]);
    expect(c).toHaveLength(1);
    expect(c[0].ids).toContain("ce8-twos-draw-two");
    // Satisfied once the dependency is on.
    expect(detectConflicts("crazyeights", ["ce8-stack-twos", "ce8-twos-draw-two"])).toHaveLength(0);
  });

  it("sanitizes rule ids to the selected game", () => {
    const cleaned = sanitizeRules("war", ["war-one-card", "ce8-twos-skip", "bogus"]);
    expect(cleaned).toEqual(["war-one-card"]);
  });

  it("every rule has a label and description", () => {
    for (const g of ["war", "gofish", "oldmaid", "crazyeights", "blackjack"]) {
      rulesFor(g).forEach((r) => {
        expect(getRule(r.id)).toBeTruthy();
        expect(r.label.length).toBeGreaterThan(0);
        expect(r.description.length).toBeGreaterThan(0);
      });
    }
  });
});
