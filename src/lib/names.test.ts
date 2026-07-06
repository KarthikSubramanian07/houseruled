import { describe, it, expect } from "vitest";
import { randomPlayerName } from "./names";

describe("randomPlayerName", () => {
  it("returns a two-word 'Adjective Noun' name", () => {
    for (let i = 0; i < 100; i++) {
      const name = randomPlayerName();
      const parts = name.split(" ");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
      // Title-cased words.
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });

  it("produces some variety", () => {
    const unique = new Set(Array.from({ length: 100 }, () => randomPlayerName()));
    expect(unique.size).toBeGreaterThan(1);
  });
});
