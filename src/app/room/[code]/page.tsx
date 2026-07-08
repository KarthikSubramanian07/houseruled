import type { Metadata } from "next";
import { Lobby } from "@/components/Lobby";
import { ButtonLink } from "@/components/Button";
import { normalizeCode, isValidCode } from "@/lib/code";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const clean = normalizeCode(code);
  return {
    title: `Table ${clean}`,
    description: `Join table ${clean} on Houseruled.`,
    // Private, ephemeral lobbies - keep them out of search results.
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = normalizeCode(code);

  if (!isValidCode(clean)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-display text-5xl text-brass">That&apos;s not a code</p>
        <p className="max-w-sm text-cream/70">
          Table codes are six characters. Double-check the link, or start fresh.
        </p>
        <ButtonLink href="/" size="lg">
          Start a table
        </ButtonLink>
      </main>
    );
  }

  return <Lobby code={clean} />;
}
