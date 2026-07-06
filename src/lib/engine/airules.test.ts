import { describe, it, expect } from "vitest";
import {
  validateAIRule,
  aiCardEffects,
  isWildByRule,
  detectAIConflicts,
  activeRules,
  type AIRule,
} from "./airules";
import { crazyeights } from "./games/crazyeights";
import { addAIRules } from "./registry";
import type { Card } from "./cards";
import type { SeatInfo } from "./types";

function rule(partial: Partial<AIRule> & { match: AIRule["match"]; effects: AIRule["effects"] }): AIRule {
  return { id: "x", raw: "test", game: "crazyeights", trigger: "card_played", duration: "permanent", ...partial };
}

describe("validateAIRule", () => {
  it("accepts a well-formed rule and clamps effect magnitudes", () => {
    const r = validateAIRule(
      { trigger: "card_played", match: { rank: 2 }, effects: [{ kind: "draw", n: 99 }] },
      "twos make the next player draw a ton",
    );
    expect(r).not.toBeNull();
    expect(r!.match.rank).toBe(2);
    expect(r!.effects[0]).toEqual({ kind: "draw", n: 8 }); // clamped to 8
  });

  it("rejects garbage (no match, no effects, wrong trigger)", () => {
    expect(validateAIRule({ trigger: "round_start", match: { rank: 2 }, effects: [{ kind: "skip", n: 1 }] }, "x")).toBeNull();
    expect(validateAIRule({ trigger: "card_played", match: {}, effects: [{ kind: "skip", n: 1 }] }, "x")).toBeNull();
    expect(validateAIRule({ trigger: "card_played", match: { rank: 2 }, effects: [] }, "x")).toBeNull();
    expect(validateAIRule("nope", "x")).toBeNull();
  });
});

describe("executor", () => {
  const seven = (): Card => ({ r: 7, s: "H" });
  it("fires effects only on matching cards and composes them", () => {
    const rules = [rule({ match: { rank: 7 }, effects: [{ kind: "skip", n: 1 }] })];
    expect(aiCardEffects(seven(), rules)).toMatchObject({ skip: 1 });
    expect(aiCardEffects({ r: 3, s: "H" }, rules)).toMatchObject({ skip: 0 });

    const two = [
      rule({ match: { rank: 7 }, effects: [{ kind: "skip", n: 1 }] }),
      rule({ match: { rank: 7 }, effects: [{ kind: "draw", n: 2 }] }),
    ];
    expect(aiCardEffects(seven(), two)).toMatchObject({ skip: 1, draw: 2 });
  });

  it("detects wild-by-rule", () => {
    const rules = [rule({ match: { rank: 4 }, effects: [{ kind: "wild" }] })];
    expect(isWildByRule({ r: 4, s: "S" }, rules)).toBe(true);
    expect(isWildByRule({ r: 5, s: "S" }, rules)).toBe(false);
  });
});

describe("conflicts + expiry", () => {
  it("surfaces rules that fire on the same card", () => {
    const rules = [
      rule({ id: "a", match: { rank: 2 }, effects: [{ kind: "skip", n: 1 }] }),
      rule({ id: "b", match: { rank: 2 }, effects: [{ kind: "draw", n: 2 }] }),
      rule({ id: "c", match: { rank: 5 }, effects: [{ kind: "reverse" }] }),
    ];
    const c = detectAIConflicts(rules);
    expect(c).toHaveLength(1);
    expect(c[0].ids.sort()).toEqual(["a", "b"]);
  });

  it("expires round-limited rules by play count", () => {
    const rules = [rule({ duration: { rounds: 1 }, addedAtPlay: 0, match: { rank: 9 }, effects: [{ kind: "reverse" }] })];
    expect(activeRules(rules, 1, 2)).toHaveLength(1); // 1 < 1*2
    expect(activeRules(rules, 2, 2)).toHaveLength(0); // 2 >= 1*2 → expired
  });
});

describe("crazyeights integration", () => {
  const seats: SeatInfo[] = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  it("applies a free-text 'fives skip' rule during real play", () => {
    let state = crazyeights.init(seats, [], 1);
    // Craft a deterministic situation: seat A to move, top 9♥, A holds 5♥ (matches suit).
    state = {
      ...state,
      turn: 0,
      discard: [{ r: 9, s: "H" }],
      currentSuit: "H",
      hands: [[{ r: 5, s: "H" }, { r: 3, s: "C" }], state.hands[1], state.hands[2]],
    };
    const fivesSkip = validateAIRule({ trigger: "card_played", match: { rank: 5 }, effects: [{ kind: "skip", n: 1 }] }, "fives skip the next player")!;
    state = addAIRules("crazyeights", state, [fivesSkip]) as typeof state;

    const r = crazyeights.apply(state, "a", { type: "play", card: { r: 5, s: "H" } });
    expect(r.ok).toBe(true);
    // Without the rule, next would be seat 1 (B); the skip pushes it to seat 2 (C).
    expect(r.state.turn).toBe(2);
    // The rule shows up in the view.
    expect(crazyeights.view(r.state, "a").aiRules?.length).toBe(1);
  });
});
