import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { proseMetadata, renderInline } from "./ProsePage";
import { ABOUT, PRIVACY } from "@/agent/content";

const html = (text: string) => renderToStaticMarkup(<>{renderInline(text)}</>);

describe("renderInline", () => {
  it("renders links, bold, and code from the doc's inline subset", () => {
    expect(html("See [llms.txt](/llms.txt)")).toBe('See <a class="text-brass no-underline transition-colors hover:text-brass-bright" href="/llms.txt">llms.txt</a>');
    expect(html("**Free** forever")).toContain("<strong");
    expect(html("call `list_games`")).toContain(">list_games</code>");
  });

  it("opens external links safely", () => {
    expect(html("[GitHub](https://github.com)")).toContain('rel="noopener noreferrer"');
  });

  it("escapes plain text", () => {
    expect(html("<script>")).toBe("&lt;script&gt;");
  });
});

describe("proseMetadata", () => {
  it("doesn't double the brand in titles that already have it", () => {
    expect(proseMetadata(ABOUT).title).toEqual({ absolute: "About Houseruled" });
    expect(proseMetadata(PRIVACY).title).toBe("Privacy policy");
  });

  it("advertises the canonical URL and the Markdown alternate", () => {
    expect(proseMetadata(ABOUT).alternates).toEqual({ canonical: "/about", types: { "text/markdown": "/about.md" } });
  });
});
