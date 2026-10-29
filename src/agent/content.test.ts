import { describe, expect, it } from "vitest";
import {
  ABOUT,
  absolutize,
  communityGameMarkdown,
  CONTACT,
  DEVELOPERS,
  docToMarkdown,
  homeDoc,
  INVENT_DOC,
  libraryMarkdown,
  llmsTxt,
  notFoundMarkdown,
  PRIVACY,
  PROSE_DOCS,
  type SiteDoc,
} from "./content";
import { GAME_CATALOG } from "../lib/engine/registry";

const SITE = "https://playhouseruled.pages.dev";

/** Visible prose of a doc, roughly what a no-JS crawler counts. */
function plainText(doc: SiteDoc): string {
  const parts = [doc.heading, doc.lede];
  for (const b of doc.blocks) parts.push(b.type === "ul" ? b.items.join(" ") : b.text);
  return parts.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "");
}

describe("trust and developer pages", () => {
  it.each(PROSE_DOCS.map((d) => [d.path, d] as const))("%s has at least 500 characters of content", (_p, doc) => {
    expect(plainText(doc).length).toBeGreaterThanOrEqual(500);
  });

  it("covers the trust anchors agents look for", () => {
    expect(PROSE_DOCS.map((d) => d.path)).toEqual(expect.arrayContaining(["/about", "/contact", "/privacy"]));
  });

  it("puts the brand in each page heading", () => {
    for (const doc of [ABOUT, CONTACT, PRIVACY, DEVELOPERS]) expect(doc.heading).toMatch(/Houseruled/);
  });

  it("gives the contact page a real channel and address, but no email by default", () => {
    const md = docToMarkdown(CONTACT, SITE);
    expect(md).toContain("github.com/KarthikSubramanian07/houseruled/issues");
    expect(md).not.toContain("mailto:");
    expect(md).toMatch(/Berkeley, California/);
  });
});

describe("docToMarkdown", () => {
  it("renders one H1, then sequential H2/H3 headings", () => {
    const md = docToMarkdown(DEVELOPERS, SITE);
    const levels = [...md.matchAll(/^(#{1,6}) /gm)].map((m) => m[1].length);
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it("makes root-relative links absolute", () => {
    const md = docToMarkdown(ABOUT, SITE);
    expect(md).toContain(`](${SITE}/contact)`);
    expect(md).not.toMatch(/\]\(\/[^)]/);
  });

  it("fences code blocks", () => {
    expect(docToMarkdown(DEVELOPERS, SITE)).toContain("```json\n{");
  });
});

describe("homeDoc", () => {
  it("lists every built-in game with player counts", () => {
    const md = docToMarkdown(homeDoc(), SITE);
    for (const g of GAME_CATALOG) expect(md).toContain(`**${g.name}**`);
    expect(md).toContain("(2 players)");
    expect(md).toContain("(1 to 6 players)");
  });

  it("leads with the brand and the product", () => {
    expect(homeDoc().heading).toMatch(/^Houseruled: .*card games/);
  });
});

describe("absolutize", () => {
  it("maps the root link to the bare origin and leaves absolute links alone", () => {
    expect(absolutize("[a](/) [b](https://x.dev/y)", SITE)).toBe(`[a](${SITE}) [b](https://x.dev/y)`);
  });
});

describe("notFoundMarkdown", () => {
  it("explains the error and links to llms.txt and the sitemap", () => {
    const md = notFoundMarkdown("/nope", SITE);
    expect(md).toMatch(/^# 404/);
    expect(md).toContain("`/nope`");
    expect(md).toContain(`${SITE}/llms.txt`);
    expect(md).toContain(`${SITE}/sitemap.xml`);
  });
});

describe("llms.txt", () => {
  const txt = llmsTxt(SITE);

  it("follows the llmstxt.org shape: H1, blockquote summary, H2 link sections", () => {
    const lines = txt.split("\n");
    expect(lines[0]).toBe("# Houseruled");
    expect(lines[2]).toMatch(/^> /);
    expect(txt).toMatch(/^## Optional$/m);
    // Every link-list entry is "- [name](url)" with an optional ": notes".
    for (const line of txt.split("\n## Docs")[1].split("\n").filter((l) => l.startsWith("- ["))) {
      expect(line).toMatch(/^- \[[^\]]+\]\(https?:\/\/[^)]+\)(: .+)?$/);
    }
  });

  it("tells agents when to use Houseruled and how to call it", () => {
    expect(txt).toMatch(/^## When to use this$/m);
    expect(txt).toMatch(/^## How to call it$/m);
    expect(txt).toContain(`${SITE}/mcp`);
    expect(txt).toContain("get_game_rules");
    expect(txt).toMatch(/Do not use Houseruled/);
  });
});

describe("library Markdown", () => {
  it("lists built-ins and community games, with an empty state", () => {
    const md = libraryMarkdown([{ slug: "chaos", title: "Chaos", baseGame: "crazyeights", explanation: "Wild.", plays: 3 }], SITE);
    expect(md).toContain(`[Chaos](${SITE}/game/chaos) (on Crazy Eights, 3 plays): Wild.`);
    expect(libraryMarkdown([], SITE)).toContain("No community games yet");
  });

  it("renders one community game's rules", () => {
    const md = communityGameMarkdown(
      { slug: "chaos", title: "Chaos", baseGame: "crazyeights", explanation: "", ruleTexts: ["Sevens reverse"], plays: 0, creatorName: "Ana" },
      SITE,
    );
    expect(md).toMatch(/^# Chaos: a Houseruled community game/);
    expect(md).toContain("- Sevens reverse");
    expect(md).toContain("Created by Ana");
  });
});

describe("copy style", () => {
  it("never uses em dashes", () => {
    const all = [llmsTxt(SITE), docToMarkdown(homeDoc(), SITE), docToMarkdown(INVENT_DOC, SITE), ...PROSE_DOCS.map((d) => docToMarkdown(d, SITE))];
    for (const text of all) expect(text).not.toContain("\u2014");
  });
});
