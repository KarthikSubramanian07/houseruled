import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import type { Block, SiteDoc } from "@/agent/content";

// Renders a SiteDoc (src/agent/content.ts) as a page. The same doc is served as
// Markdown to agents, so this only understands the doc's tiny inline subset:
// [links](href), **bold**, and `code`.

const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = m.index;
    if (m[1] !== undefined) {
      const href = m[2];
      const cls = "text-brass no-underline transition-colors hover:text-brass-bright";
      out.push(
        href.startsWith("/") ? (
          <Link key={key} href={href} className={cls}>{m[1]}</Link>
        ) : (
          <a key={key} href={href} className={cls} rel="noopener noreferrer">{m[1]}</a>
        ),
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-cream">{m[3]}</strong>);
    } else {
      out.push(<code key={key} className="rounded bg-felt-deep/70 px-1.5 py-0.5 font-mono text-[0.85em] text-brass-bright">{m[4]}</code>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return <h2 className="mt-6 font-display text-2xl text-cream">{block.text}</h2>;
    case "h3":
      return <h3 className="mt-2 font-display text-lg text-brass">{block.text}</h3>;
    case "p":
      return <p className="leading-relaxed text-cream/75">{renderInline(block.text)}</p>;
    case "ul":
      return (
        <ul className="flex flex-col gap-2 pl-5 text-cream/75 marker:text-brass/70 [list-style:disc]">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre className="felt-panel overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed text-cream/85">
          <code>{block.text}</code>
        </pre>
      );
  }
}

export function ProsePage({ doc }: { doc: SiteDoc }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 pb-16 pt-4 sm:px-8">
        <h1 className="font-display text-4xl leading-tight text-cream sm:text-5xl">{doc.heading}</h1>
        <p className="text-lg leading-relaxed text-cream/70">{renderInline(doc.lede)}</p>
        {doc.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </main>
      <SiteFooter />
    </>
  );
}

/** Page metadata derived from the doc, so title/description match the Markdown. */
export function proseMetadata(doc: SiteDoc): Metadata {
  // The layout's template appends " · Houseruled"; skip it when the brand is already there.
  return {
    title: doc.title.includes("Houseruled") ? { absolute: doc.title } : doc.title,
    description: doc.description,
    alternates: { canonical: doc.path, types: { "text/markdown": `${doc.path}.md` } },
    openGraph: { title: `${doc.title} · Houseruled`, description: doc.description, url: doc.path },
  };
}
