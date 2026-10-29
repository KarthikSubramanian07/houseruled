import { describe, expect, it } from "vitest";
import { appendVaryAccept, normalizePath, parseAccept, preferredType, wantsMarkdown } from "./negotiate";

const BOTH = ["text/html", "text/markdown"];

describe("preferredType", () => {
  it("defaults to HTML with no header, an empty header, or */*", () => {
    expect(preferredType(null, BOTH)).toBe("text/html");
    expect(preferredType("", BOTH)).toBe("text/html");
    expect(preferredType("*/*", BOTH)).toBe("text/html");
  });

  it("serves Markdown when it is the only thing asked for", () => {
    expect(preferredType("text/markdown", BOTH)).toBe("text/markdown");
  });

  it("keeps browsers on HTML", () => {
    const chrome = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    expect(preferredType(chrome, BOTH)).toBe("text/html");
  });

  it("honors q-values over order", () => {
    expect(preferredType("text/html;q=0.5, text/markdown", BOTH)).toBe("text/markdown");
    expect(preferredType("text/markdown;q=0.2, text/html", BOTH)).toBe("text/html");
  });

  it("breaks q ties by the client's order", () => {
    expect(preferredType("text/markdown, text/html", BOTH)).toBe("text/markdown");
    expect(preferredType("text/html, text/markdown", BOTH)).toBe("text/html");
  });

  it("lets the most specific range set a type's q", () => {
    // text/* allows markdown, but the exact text/html;q=0 rules html out.
    expect(preferredType("text/*, text/html;q=0", BOTH)).toBe("text/markdown");
  });

  it("returns null when nothing is acceptable", () => {
    expect(preferredType("application/json", BOTH)).toBeNull();
    expect(preferredType("text/markdown;q=0, text/html;q=0", BOTH)).toBeNull();
  });

  it("ignores malformed entries", () => {
    expect(parseAccept("garbage, text/markdown;q=abc")).toEqual([{ type: "text/markdown", q: 1, specificity: 2 }]);
  });
});

describe("wantsMarkdown", () => {
  it("is true only when Markdown beats HTML", () => {
    expect(wantsMarkdown("text/markdown")).toBe(true);
    expect(wantsMarkdown("text/markdown, text/plain;q=0.5")).toBe(true);
    expect(wantsMarkdown("text/html")).toBe(false);
    expect(wantsMarkdown(null)).toBe(false);
  });
});

describe("appendVaryAccept", () => {
  it("adds Accept to Next's existing Vary without clobbering it", () => {
    const h = new Headers({ Vary: "rsc, next-router-state-tree" });
    appendVaryAccept(h);
    expect(h.get("vary")).toBe("rsc, next-router-state-tree, Accept");
  });

  it("sets it when absent and never duplicates it", () => {
    const h = new Headers();
    appendVaryAccept(h);
    appendVaryAccept(h);
    expect(h.get("vary")).toBe("Accept");
  });
});

describe("normalizePath", () => {
  it("drops a trailing slash except on root", () => {
    expect(normalizePath("/about/")).toBe("/about");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});
