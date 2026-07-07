import { DonateLink } from "./DonateLink";

/** The site footer: a warm sign-off and a single, centered support link. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-3 px-6 pb-8 pt-6 text-center sm:px-10">
      <p className="text-xs text-cream/35">Bring the deck. We&apos;ll keep the felt.</p>
      <DonateLink />
    </footer>
  );
}
