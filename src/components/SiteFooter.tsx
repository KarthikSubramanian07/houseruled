import { DonateLink } from "./DonateLink";

/** The site footer: a warm sign-off, a support link, and honest "free forever"
 *  framing. Kept quiet so it never competes with the felt. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-3 px-6 pb-8 pt-4 text-center sm:px-10">
      <p className="text-xs text-cream/35">Bring the deck. We&apos;ll keep the felt.</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-cream/40">
        <span>Free forever</span>
        <span aria-hidden className="text-cream/20">
          ·
        </span>
        <DonateLink />
      </div>
    </footer>
  );
}
