import { ButtonLink } from "@/components/Button";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <>
      <header className="px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-display text-6xl text-brass">Off the table</p>
        <p className="max-w-sm text-cream/70">
          This page folded. Let&apos;s get you back to the felt.
        </p>
        <ButtonLink href="/" size="lg">
          Back to the table
        </ButtonLink>
      </main>
    </>
  );
}
