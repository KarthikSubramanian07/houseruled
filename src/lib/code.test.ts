import { describe, it, expect } from "vitest";
import { generateRoomCode, normalizeCode, isValidCode, CODE_LENGTH } from "./code";

const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3467";
const AMBIGUOUS = ["O", "0", "I", "1", "S", "5", "B", "8", "Z", "2"];

describe("generateRoomCode", () => {
  it("always produces a code of the fixed length", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).toHaveLength(CODE_LENGTH);
    }
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateRoomCode()) {
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  it("never emits look-alike characters", () => {
    const codes = Array.from({ length: 300 }, () => generateRoomCode()).join("");
    for (const bad of AMBIGUOUS) {
      expect(codes).not.toContain(bad);
    }
  });

  it("produces varied output (not a constant)", () => {
    const unique = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("emits codes that pass its own validator", () => {
    for (let i = 0; i < 100; i++) {
      expect(isValidCode(generateRoomCode())).toBe(true);
    }
  });
});

describe("normalizeCode", () => {
  it("uppercases valid input", () => {
    expect(normalizeCode("acdefg")).toBe("ACDEFG");
  });

  it("strips characters outside the alphabet", () => {
    // B, 1, 2, O, 0 are all not in the alphabet and should be dropped.
    expect(normalizeCode("a1b2o0")).toBe("A");
  });

  it("drops whitespace and separators", () => {
    expect(normalizeCode("  ac de-fg  ")).toBe("ACDEFG");
  });

  it("truncates to the code length", () => {
    expect(normalizeCode("ACDEFGHJK")).toBe("ACDEFG");
    expect(normalizeCode("ACDEFGHJK")).toHaveLength(CODE_LENGTH);
  });

  it("returns empty string for all-invalid input", () => {
    expect(normalizeCode("108825")).toBe("");
  });
});

describe("isValidCode", () => {
  it("accepts a normalized 6-char code", () => {
    expect(isValidCode("ACDEFG")).toBe(true);
  });

  it("rejects lowercase (not normalized)", () => {
    expect(isValidCode("acdefg")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidCode("ACDEF")).toBe(false);
    expect(isValidCode("ACDEFGH")).toBe(false);
  });

  it("rejects codes containing ambiguous/invalid characters", () => {
    expect(isValidCode("ACDEFB")).toBe(false); // B is excluded
    expect(isValidCode("ACDEF0")).toBe(false); // 0 is excluded
  });
});
