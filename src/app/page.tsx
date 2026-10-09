import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeActions } from "@/components/HomeActions";
import { SiteFooter } from "@/components/SiteFooter";
import { AdSlot } from "@/components/AdSense";
import { HAS_REMOTE_BACKEND } from "@/lib/env";
import { GAME_CATALOG } from "@/lib/engine/registry";

export const metadata: Metadata = {
  alternates: { canonical: "/", types: { "text/markdown": "/index.md" } },
};

const STEPS = [
  { title: "Start a table", body: "One tap deals you a room with a six-letter code and a link to share." },
  { title: "Friends pull up a chair", body: "They open the link on any phone or laptop. No app, no account, no download." },
  { title: "Set the house rules", body: "Toggle the variants your table plays by, or type a rule in plain English, then deal." },
];

function players(min: number, max: number): string {
  return min === max ? `${min} players` : `${min}-${max} players`;
}

export default function Home() {
  const live = HAS_REMOTE_BACKEND;
  const gameCount = GAME_CATALOG.length;

  return (
    <>
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-6 text-center">
        {/* w-full constrains the column to the padded viewport so the copy wraps
            instead of growing to its max-width and clipping on narrow screens. */}
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <h1
            className="font-display font-semibold leading-[1.08] tracking-tight text-cream"
            style={{ fontSize: "var(--text-hero)" }}
          >
            {/* Brand + product in the H1 for search and agents; reads as a quiet kicker. */}
            <span className="mb-4 block font-sans text-xs font-medium uppercase tracking-[0.25em] text-brass/80 sm:text-sm">
              Houseruled<span className="sr-only">:</span>
              <span aria-hidden className="text-cream/25"> · </span>
              free online card games with friends
            </span>
            Your rules.
            <br />
            Your game.
            <br />
            <span className="text-brass">Any deck.</span>
          </h1>

          <p className="w-full max-w-xl text-base leading-relaxed text-balance text-cream/70 sm:text-lg">
            Pull up a chair, deal a hand, and bend the rules however your table
            likes. Start a game, share the link, and play with friends in seconds.
          </p>

          <div className="mt-4 flex w-full justify-center">
            <HomeActions />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/invent" className="text-brass no-underline transition-colors hover:text-brass-bright">
              ✦ Invent a game with AI
            </Link>
            <span aria-hidden className="text-cream/20">·</span>
            <Link href="/games" className="text-cream/60 no-underline transition-colors hover:text-cream">
              Browse the community library
            </Link>
          </div>

          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-cream/45">
            <span><span className="text-brass">{gameCount}</span> games ready to deal</span>
            <span aria-hidden className="text-cream/20">·</span>
            <span>house rules in plain English</span>
            <span aria-hidden className="text-cream/20">·</span>
            <span>no sign-up, just a link</span>
          </p>

          {!live && (
            <p className="mt-2 w-full max-w-md text-xs leading-relaxed text-cream/40">
              Running in <span className="text-cream/60">table-demo mode</span> -
              this is a local <code className="text-cream/60">next dev</code>{" "}
              build. Deploy to Cloudflare (or run{" "}
              <code className="text-cream/60">wrangler dev</code>) for live,
              shareable multiplayer.
            </p>
          )}
        </div>
      </main>

      <section aria-labelledby="how" className="mx-auto w-full max-w-4xl px-6 pb-12 sm:px-10">
        <h2 id="how" className="text-center font-display text-3xl text-cream">How a game night works</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="felt-panel rounded-xl p-5">
              <span className="tabular font-display text-2xl text-brass">{i + 1}</span>
              <h3 className="mt-1 font-display text-lg text-cream">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-cream/60">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="games" className="mx-auto w-full max-w-4xl px-6 pb-16 sm:px-10">
        <h2 id="games" className="text-center font-display text-3xl text-cream">
          {gameCount} card games, one felt
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-cream/55">
          From a five-minute round of War to a long night of Cribbage. Every game deals at a live table, and every one takes house rules.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {GAME_CATALOG.map((g) => (
            <li key={g.type} className="felt-panel rounded-xl px-4 py-3">
              <h3 className="flex items-baseline justify-between gap-3">
                <span className="font-display text-lg text-cream">{g.name}</span>
                <span className="tabular shrink-0 font-sans text-xs text-brass/70">{players(g.minPlayers, g.maxPlayers)}</span>
              </h3>
              <p className="mt-0.5 text-sm leading-relaxed text-cream/60">{g.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* One quiet ad slot, well below the fold. Renders nothing unless AdSense
          is configured - so it never shows an empty box in dev or demo mode. */}
      <div className="px-5 sm:px-8">
        <AdSlot className="mb-8" />
      </div>

      <SiteFooter />
    </>
  );
}
