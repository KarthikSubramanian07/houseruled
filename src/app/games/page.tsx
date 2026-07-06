"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<LibGame[] | null>(null);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((d: { games?: LibGame[] }) => setGames(d.games ?? []))
      .catch(() => setGames([]));
  }, []);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
        <Link href="/invent" className="text-sm text-brass no-underline hover:text-brass-bright">
          + Invent a game
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 pb-16 pt-4 sm:px-8">
        <div className="text-center">
          <h1 className="font-display text-4xl text-cream">The community library</h1>
          <p className="mt-2 text-sm text-cream/60">Custom games invented by players. Most-played first.</p>
        </div>

        {games === null ? (
          <p className="text-center text-cream/50">Loading…</p>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-cream/60">No games yet — be the first.</p>
            <ButtonLink href="/invent" size="lg">Invent a game</ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {games.map((g) => (
              <li key={g.slug} className="felt-panel flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-lg text-cream">{g.title}</span>
                    <span className="text-xs text-cream/40">
                      on {GAME_CATALOG.find((c) => c.type === g.baseGame)?.name ?? g.baseGame}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-cream/60">{g.explanation}</p>
                  <p className="tabular mt-1 text-xs text-brass/70">{g.plays} plays</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="quiet" size="md" onClick={() => router.push(`/game/${g.slug}`)}>
                    View
                  </Button>
                  <Button size="md" onClick={() => startCustomTable((h) => router.push(h), g.baseGame, g.ruleTexts)}>
                    Play
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
