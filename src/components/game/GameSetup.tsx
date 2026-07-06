"use client";

import { useMemo, useState } from "react";
import { Button } from "../Button";
import { GAME_CATALOG } from "@/lib/engine/registry";
import { rulesFor, detectConflicts } from "@/lib/engine/houserules";

/** Host-only pre-game picker: choose a game, toggle curated house rules (with live
 *  conflict detection), then deal. Non-hosts see a quiet waiting state. */
export function GameSetup({
  playerCount,
  isHost,
  onStart,
}: {
  playerCount: number;
  isHost: boolean;
  onStart: (game: string, rules: string[]) => void;
}) {
  const [game, setGame] = useState<string | null>(null);
  const [rules, setRules] = useState<Set<string>>(new Set());

  const conflicts = useMemo(
    () => (game ? detectConflicts(game, [...rules]) : []),
    [game, rules],
  );
  const meta = GAME_CATALOG.find((g) => g.type === game);
  const fits = meta ? playerCount >= meta.minPlayers && playerCount <= meta.maxPlayers : false;
  const canStart = !!game && fits && conflicts.length === 0;

  if (!isHost) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-2xl text-cream/80">Waiting for the host…</p>
        <p className="mt-2 text-sm text-cream/50">
          The host is choosing a game and setting the house rules.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseGame(type: string) {
    setGame(type);
    setRules(new Set()); // rules are per-game
  }

  const gameRules = game ? rulesFor(game) : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display text-3xl text-cream">Choose a game</h2>
        <p className="mt-1 text-sm text-cream/50">{playerCount} at the table.</p>
      </div>

      {/* Game picker */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {GAME_CATALOG.map((g) => {
          const ok = playerCount >= g.minPlayers && playerCount <= g.maxPlayers;
          const active = game === g.type;
          return (
            <button
              key={g.type}
              onClick={() => chooseGame(g.type)}
              disabled={!ok}
              className={`felt-panel rounded-xl p-4 text-left transition-colors disabled:opacity-40 ${
                active ? "!border-brass ring-1 ring-brass" : "hover:border-brass/50"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg text-cream">{g.name}</span>
                <span className="tabular text-xs text-cream/45">
                  {g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-cream/55">{g.blurb}</p>
              {!ok && <p className="mt-1 text-xs text-ember/80">Needs {g.minPlayers}–{g.maxPlayers} players.</p>}
            </button>
          );
        })}
      </div>

      {/* House rules */}
      {game && gameRules.length > 0 && (
        <div className="felt-panel rounded-xl p-4">
          <h3 className="plaque-header mb-3 text-xs text-brass">House Rules — optional</h3>
          <div className="flex flex-col gap-1.5">
            {gameRules.map((r) => {
              const on = rules.has(r.id);
              const conflicted = conflicts.some((c) => c.ids.includes(r.id));
              return (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-brass/5"
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                      on
                        ? conflicted
                          ? "border-ember bg-ember/80 text-cream"
                          : "border-brass bg-brass text-felt-deep"
                        : "border-cream/25 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span>
                    <span className="text-sm text-cream">{r.label}</span>
                    <span className="ml-2 text-xs text-cream/45">{r.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {conflicts.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2">
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-ember">
                  {c.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button size="lg" disabled={!canStart} onClick={() => game && onStart(game, [...rules])}>
          {game ? `Deal ${meta?.name}` : "Pick a game"}
        </Button>
        {game && !fits && (
          <p className="text-xs text-ember/80">
            {meta?.name} needs {meta?.minPlayers}–{meta?.maxPlayers} players.
          </p>
        )}
      </div>
    </div>
  );
}
