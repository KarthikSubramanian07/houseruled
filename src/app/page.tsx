import { Wordmark } from "@/components/Wordmark";
import { HomeActions } from "@/components/HomeActions";
import { SiteFooter } from "@/components/SiteFooter";
import { AdSlot } from "@/components/AdSense";
import { DonateLink } from "@/components/DonateLink";
import { HAS_REMOTE_BACKEND } from "@/lib/env";

export default function Home() {
  const live = HAS_REMOTE_BACKEND;

  return (
    <>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
        <DonateLink />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-6 text-center">
        {/* w-full constrains the column to the padded viewport so the copy wraps
            instead of growing to its max-width and clipping on narrow screens. */}
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brass">
            free forever · no app · no account
          </p>

          <h1
            className="font-display font-semibold leading-[0.95] tracking-tight text-cream"
            style={{ fontSize: "var(--text-hero)" }}
          >
            Your rules.
            <br />
            Your game.
            <br />
            <span className="text-brass">Any deck.</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-cream/70 sm:text-lg">
            Pull up a chair, deal a hand, and bend the rules however your table
            likes. Start a game, share the link, and play with friends in seconds.
          </p>

          <div className="mt-4 flex justify-center">
            <HomeActions />
          </div>

          {!live && (
            <p className="mt-2 max-w-md text-xs leading-relaxed text-cream/40">
              Running in <span className="text-cream/60">table-demo mode</span> —
              this is a local <code className="text-cream/60">next dev</code>{" "}
              build. Deploy to Cloudflare (or run{" "}
              <code className="text-cream/60">wrangler dev</code>) for live,
              shareable multiplayer.
            </p>
          )}
        </div>
      </main>

      {/* One quiet ad slot, well below the fold. Renders nothing unless AdSense
          is configured — so it never shows an empty box in dev or demo mode. */}
      <div className="px-5 sm:px-8">
        <AdSlot className="mb-8" />
      </div>

      <SiteFooter />
    </>
  );
}
