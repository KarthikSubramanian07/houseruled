"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ButtonLink } from "@/components/Button";
import { FavoriteButton } from "@/components/FavoriteButton";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { getPlayer } from "@/lib/identity";

interface LibGame {
  slug: string;
  title: string;
  baseGame: string;
  explanation: string;
  plays: number;
  creatorId: string | null;
  creatorName: string | null;
}

// Invented games can only be built on these five bases (see lib/ai/gamegen.ts),
// so the filter offers only these - the other games would be dead options.
const INVENTABLE_BASES = new Set(["war", "gofish", "oldmaid", "crazyeights", "blackjack"]);

export default function GamesPage() {
  const [games, setGames] = useState<LibGame[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [base, setBase] = useState("");
  const [sort, setSort] = useState<"plays" | "new">("plays");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (base) params.set("base", base);
    params.set("sort", sort);
    params.set("user", getPlayer().id);
    fetch(`/api/games?${params}`)
      .then((r) => r.json())
      .then((d: { games?: LibGame[]; favorites?: string[] }) => {
        setGames(d.games ?? []);
        setFavs(new Set(d.favorites ?? []));
      })
      .catch(() => setGames([]));
  }, [search, base, sort]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce typing
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 pb-16 pt-4 sm:px-8">
        <div className="text-center">
          <h1 className="font-display text-4xl text-cream">The community library</h1>
          <p className="mt-2 text-sm text-cream/60">Games dreamed up by players. Steal them, remix them, make them yours.</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            aria-label="Search the community library"
            className="felt-panel min-w-0 flex-1 rounded-full px-4 py-2 text-sm text-cream placeholder:text-cream/30"
          />
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            aria-label="Filter by base game"
            className="felt-panel rounded-full px-3 py-2 text-sm text-cream"
          >
            <option value="">All base games</option>
            {GAME_CATALOG.filter((g) => INVENTABLE_BASES.has(g.type)).map((g) => (
              <option key={g.type} value={g.type}>{g.name}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-full border border-brass/25 text-sm">
            {(["plays", "new"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                aria-pressed={sort === s}
                className={`px-4 py-2 transition-colors ${sort === s ? "bg-brass/20 text-brass" : "text-cream/50 hover:text-cream"}`}
              >
                {s === "plays" ? "Top" : "New"}
              </button>
            ))}
          </div>
        </div>

        {games === null ? (
          <p className="text-center text-cream/50">Shuffling the deck…</p>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-cream/60">{search || base ? "Nothing matches - try a different search." : "No games yet - be the first to invent one."}</p>
            <ButtonLink href="/invent" size="lg">Invent a game</ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {games.map((g) => (
              <li key={g.slug} className="felt-panel flex items-start justify-between gap-3 rounded-xl p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/game/${g.slug}`} className="font-display text-lg text-cream no-underline hover:text-brass">{g.title}</Link>
                    <span className="text-xs text-cream/40">
                      on {GAME_CATALOG.find((c) => c.type === g.baseGame)?.name ?? g.baseGame}
                      {g.creatorName && g.creatorId && (
                        <> · by <Link href={`/u/${g.creatorId}`} className="text-brass/70 no-underline hover:text-brass">{g.creatorName}</Link></>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-cream/60">{g.explanation}</p>
                  <p className="tabular mt-1 text-xs text-brass/70">{g.plays} plays</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <FavoriteButton slug={g.slug} initial={favs.has(g.slug)} />
                  <ButtonLink href={`/game/${g.slug}`} size="md">Play</ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
