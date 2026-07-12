"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ButtonLink } from "@/components/Button";
import { NameEditor } from "@/components/NameEditor";
import { FavoriteButton } from "@/components/FavoriteButton";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { useIsPlayerId } from "@/lib/use-player";

interface LibGame {
  slug: string;
  title: string;
  baseGame: string;
  explanation: string;
  plays: number;
  creatorName: string | null;
}
interface Profile {
  id: string;
  name: string | null;
  createdAt: string | null;
  createdGames: LibGame[];
  favorites: LibGame[];
  totalPlays: number;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function GameCard({ g }: { g: LibGame }) {
  const base = GAME_CATALOG.find((c) => c.type === g.baseGame)?.name ?? g.baseGame;
  return (
    <div className="felt-panel flex flex-col gap-1.5 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/game/${g.slug}`} className="font-display text-lg text-cream no-underline hover:text-brass">{g.title}</Link>
        <FavoriteButton slug={g.slug} size="sm" />
      </div>
      <span className="text-xs text-cream/40">on {base} · {g.plays} plays</span>
      <p className="line-clamp-2 text-sm text-cream/60">{g.explanation}</p>
      <div className="mt-1">
        <ButtonLink href={`/game/${g.slug}`} size="md">Play →</ButtonLink>
      </div>
    </div>
  );
}

function ProfileSection({ title, games, empty }: { title: string; games: LibGame[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="plaque-header text-sm text-brass/70">{title}</h2>
      {games.length === 0 ? (
        <p className="text-sm text-cream/40">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {games.map((g) => (
            <GameCard key={g.slug} g={g} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileBody({ id, isMe }: { id: string; isMe: boolean }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile/${id}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; profile?: Profile }) => {
        if (!cancelled) setProfile(d.ok && d.profile ? d.profile : null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  if (profile === undefined) {
    return <p className="text-center text-cream/50">Pulling their record…</p>;
  }
  if (profile === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="font-display text-4xl text-brass">No profile yet</p>
        <p className="max-w-sm text-cream/60">{isMe ? "Invent or favorite a game and your profile fills in." : "This player hasn't made their mark yet."}</p>
        <ButtonLink href="/invent" size="lg">Invent a game</ButtonLink>
      </div>
    );
  }

  return (
    <>
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-felt-dark text-2xl font-semibold text-cream ring-2 ring-brass/60">
          {initials(profile.name ?? "Player")}
        </div>
        {isMe ? (
          <NameEditor />
        ) : (
          <h1 className="font-display text-3xl text-cream">{profile.name ?? "Anonymous player"}</h1>
        )}
        {profile.createdAt && (
          <p className="text-xs text-cream/40">
            Joined {new Date(profile.createdAt + "Z").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
        )}
        <button onClick={share} className="text-xs text-cream/50 underline hover:text-brass">
          {copied ? "Link copied ✓" : "Share this profile"}
        </button>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Games made", value: profile.createdGames.length },
          { label: "Favorites", value: profile.favorites.length },
          { label: "Total plays", value: profile.totalPlays },
        ].map((s) => (
          <div key={s.label} className="felt-panel flex flex-col items-center rounded-xl py-4">
            <span className="tabular font-display text-3xl text-brass">{s.value}</span>
            <span className="text-xs text-cream/50">{s.label}</span>
          </div>
        ))}
      </section>

      <ProfileSection title={isMe ? "Games you've invented" : "Invented games"} games={profile.createdGames} empty="No games invented yet." />
      <ProfileSection title="Favorites" games={profile.favorites} empty="No favorites yet." />
    </>
  );
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isMe = useIsPlayerId(id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 pb-16 pt-4 sm:px-8">
        <ProfileBody key={id} id={id} isMe={isMe} />
      </main>
      <SiteFooter />
    </>
  );
}
