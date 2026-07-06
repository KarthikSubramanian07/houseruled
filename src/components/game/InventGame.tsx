"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { getPlayer } from "@/lib/identity";
import { startCustomTable } from "@/lib/play";

interface Generated {
  name: string;
  baseGame: string;
  ruleTexts: string[];
  explanation: string;
}

/** Describe a game in a sentence → AI designs it → review → play or save. */
export function InventGame() {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Generated | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setGame(null);
    setSavedSlug(null);
    try {
      const res = await fetch("/api/generate-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const data = (await res.json()) as { ok: boolean; game?: Generated; error?: string };
      if (data.ok && data.game) setGame(data.game);
      else setError(data.error ?? "Couldn't design that game.");
    } catch {
      setError("Couldn't reach the game designer.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!game) return;
    setSaving(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...game, creatorId: getPlayer().id }),
      });
      const data = (await res.json()) as { ok: boolean; slug?: string };
      if (data.ok && data.slug) setSavedSlug(data.slug);
    } finally {
      setSaving(false);
    }
  }

  const baseName = game ? GAME_CATALOG.find((g) => g.type === game.baseGame)?.name ?? game.baseGame : "";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="text-center">
        <h1 className="font-display text-4xl text-cream">Invent a game</h1>
        <p className="mt-2 text-sm text-cream/60">
          Describe a card game in a sentence. The AI builds it on one of the five engine games and writes the rules.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="e.g. Crazy Eights but twos attack, queens turn the tables, and sevens let you go again"
          className="felt-panel w-full rounded-2xl px-4 py-3 text-sm text-cream placeholder:text-cream/30"
        />
        <Button size="lg" disabled={loading || desc.trim().length < 4} onClick={generate}>
          {loading ? "Designing…" : "Design my game"}
        </Button>
        {error && <p className="text-center text-sm text-ember">{error}</p>}
      </div>

      {game && (
        <div className="plaque flex flex-col gap-3 px-5 pb-5 pt-6">
          <div className="text-center">
            <h2 className="font-display text-2xl text-ink">{game.name}</h2>
            <p className="mt-1 text-xs uppercase tracking-widest text-brass-dim">Based on {baseName}</p>
          </div>
          <p className="text-center text-sm leading-relaxed text-ink/75">{game.explanation}</p>
          {game.ruleTexts.length > 0 && (
            <ul className="mx-auto flex flex-col gap-1 text-sm text-ink/80">
              {game.ruleTexts.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-col items-center gap-2">
            <Button size="lg" onClick={() => startCustomTable((h) => router.push(h), game.baseGame, game.ruleTexts)}>
              Play it now
            </Button>
            {savedSlug ? (
              <p className="text-xs text-ink/60">
                Saved! Share:{" "}
                <span className="font-mono text-ink">/game/{savedSlug}</span>
              </p>
            ) : (
              <button onClick={save} disabled={saving} className="text-xs text-ink/60 underline hover:text-ink">
                {saving ? "Saving…" : "Save to the community library"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
