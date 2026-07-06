"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Button, ButtonLink } from "@/components/Button";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { startCustomTable } from "@/lib/play";

interface LibGame {
  slug: string;
  title: string;
  baseGame: string;
  ruleTexts: string[];
  explanation: string;
  plays: number;
}

export default function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<LibGame | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/games/${slug}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; game?: LibGame }) => setGame(d.ok && d.game ? d.game : null))
      .catch(() => setGame(null));
  }, [slug]);

  async function play() {
    if (!game) return;
    // Record a play, then start a preloaded table.
    fetch(`/api/games/${slug}`, { method: "POST" }).catch(() => {});
    await startCustomTable((h) => router.push(h), game.baseGame, game.ruleTexts);
  }

  return (
    <>
      <header className="px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 text-center">
        {game === undefined ? (
          <p className="text-cream/50">Loading…</p>
        ) : game === null ? (
          <>
            <p className="font-display text-4xl text-brass">Game not found</p>
            <ButtonLink href="/games" size="lg">Browse the library</ButtonLink>
          </>
        ) : (
          <div className="plaque flex w-full flex-col gap-3 px-6 pb-6 pt-7">
            <h1 className="font-display text-3xl text-ink">{game.title}</h1>
            <p className="text-xs uppercase tracking-widest text-brass-dim">
              Based on {GAME_CATALOG.find((c) => c.type === game.baseGame)?.name ?? game.baseGame} · {game.plays} plays
            </p>
            <p className="text-sm leading-relaxed text-ink/75">{game.explanation}</p>
            {game.ruleTexts.length > 0 && (
              <ul className="mx-auto flex flex-col gap-1 text-sm text-ink/80">
                {game.ruleTexts.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              <Button size="lg" onClick={play}>Play this game</Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
