import Link from "next/link";
import { DonateLink } from "./DonateLink";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/developers", label: "Developers" },
];

/** The site footer: a warm sign-off, the trust pages, and a single support link. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-3 px-6 pb-8 pt-6 text-center sm:px-10">
      <p className="text-xs text-cream/35">Bring the deck. We&apos;ll keep the felt.</p>
      <nav aria-label="Site" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-cream/40 no-underline transition-colors hover:text-cream">
            {l.label}
          </Link>
        ))}
      </nav>
      <DonateLink />
    </footer>
  );
}
