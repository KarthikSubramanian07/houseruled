import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeActions } from "@/components/HomeActions";
import { SiteFooter } from "@/components/SiteFooter";
import { AdSlot } from "@/components/AdSense";
import { HAS_REMOTE_BACKEND } from "@/lib/env";
import { GAME_CATALOG } from "@/lib/engine/registry";

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

          <div className="mt-4 flex justify-center">
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

      {/* One quiet ad slot, well below the fold. Renders nothing unless AdSense
          is configured - so it never shows an empty box in dev or demo mode. */}
      <div className="px-5 sm:px-8">
        <AdSlot className="mb-8" />
      </div>

      <SiteFooter />
    </>
  );
}
