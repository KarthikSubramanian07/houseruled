import { DONATE_URL } from "@/lib/env";

/** A quiet "buy me a coffee" link. Houseruled is free forever - this just helps
 *  keep the felt on the table. */
export function DonateLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm text-cream/55 no-underline transition-colors hover:text-brass ${className}`}
    >
      <span aria-hidden>☕</span>
      Buy me a coffee
    </a>
  );
}
