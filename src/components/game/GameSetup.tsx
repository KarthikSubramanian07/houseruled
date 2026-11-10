"use client";

import { useMemo, useState } from "react";
import { Button } from "../Button";
import { HowToPlay } from "./HowToPlay";
import { GAME_CATALOG, supportsAIRules } from "@/lib/engine/registry";
import { rulesFor, detectConflicts } from "@/lib/engine/houserules";
import { summarizeRule, type AIRule } from "@/lib/engine/airules";
import { takePreload, type Preload } from "@/lib/play";

function initialPreload(isHost: boolean): Preload | null {
  if (!isHost) return null;
  const pre = takePreload();
  if (!pre || !GAME_CATALOG.some((g) => g.type === pre.baseGame)) return null;
  return pre;
}

/** Host-only pre-game picker: choose a game, toggle curated house rules (with live
 *  conflict detection), then deal. Non-hosts see a quiet waiting state. */
export function GameSetup({
  playerCount,
  isHost,
  onStart,
}: {
  playerCount: number;
  isHost: boolean;
  onStart: (game: string, rules: string[], ruleTexts: string[]) => void;
}) {
  const preload = initialPreload(isHost);
  const [game, setGame] = useState<string | null>(preload?.baseGame ?? null);
  const [rules, setRules] = useState<Set<string>>(new Set());
  const [customRules, setCustomRules] = useState<{ text: string; summary: string }[]>(
    () => preload?.ruleTexts.map((text) => ({ text, summary: "custom rule" })) ?? [],
  );
  const [ruleInput, setRuleInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function addCustomRule() {
    const text = ruleInput.trim();
    if (!text || !game) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/parse-rule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, game }),
      });
      const data = (await res.json()) as { ok: boolean; rule?: AIRule; error?: string };
      if (data.ok && data.rule) {
        setCustomRules((prev) => [...prev, { text, summary: summarizeRule(data.rule!) }]);
        setRuleInput("");
      } else {
        setParseError(data.error ?? "Couldn't read that rule.");
      }
    } catch {
      setParseError("Couldn't reach the rules engine.");
    } finally {
      setParsing(false);
    }
  }

  const conflicts = useMemo(
    () => (game ? detectConflicts(game, [...rules]) : []),
    [game, rules],
  );
  const meta = GAME_CATALOG.find((g) => g.type === game);
  const fits = meta ? playerCount >= meta.minPlayers && playerCount <= meta.maxPlayers : false;
  const canStart = !!game && fits && conflicts.length === 0;

  if (!isHost) {
    return (
      <div className="mx-auto max-w-md text-center" role="status" aria-live="polite">
        <p className="font-display text-2xl text-cream">Waiting for the host…</p>
        <p className="mt-2 text-sm text-cream/80">
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
    setCustomRules([]);
    setRuleInput("");
    setParseError(null);
  }

  const gameRules = game ? rulesFor(game) : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display text-3xl text-cream">Choose a game</h2>
        <p className="mt-1 text-sm text-cream/80">{playerCount} at the table.</p>
      </div>

      {/* Game picker */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="listbox" aria-label="Games">
        {GAME_CATALOG.map((g) => {
          const ok = playerCount >= g.minPlayers && playerCount <= g.maxPlayers;
          const active = game === g.type;
          return (
            <button
              key={g.type}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => chooseGame(g.type)}
              disabled={!ok}
              className={`felt-panel rounded-xl p-4 text-left transition disabled:opacity-40 ${
                active ? "!border-brass ring-1 ring-brass" : "enabled:hover:-translate-y-0.5 hover:border-brass/50"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg text-cream">{g.name}</span>
                <span className="tabular text-xs text-cream/80">
                  {g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-cream/80">{g.blurb}</p>
              {!ok && <p className="mt-1 text-xs text-ember">Needs {g.minPlayers}–{g.maxPlayers} players.</p>}
            </button>
          );
        })}
      </div>

      {/* How to play the selected game */}
      {meta && (
        <div className="-mt-2 flex items-center justify-center gap-2 text-sm text-cream/80">
          <span>New to {meta.name}?</span>
          <HowToPlay type={meta.type} name={meta.name} className="!text-brass hover:!text-brass-bright" />
        </div>
      )}

      {/* House rules */}
      {game && gameRules.length > 0 && (
        <div className="felt-panel rounded-xl p-4">
          <h3 className="plaque-header mb-3 text-xs text-brass">House Rules - optional</h3>
          <div className="flex flex-col gap-1.5" role="group" aria-label="House rules">
            {gameRules.map((r) => {
              const on = rules.has(r.id);
              const conflicted = conflicts.some((c) => c.ids.includes(r.id));
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={on}
                  className="flex min-h-6 items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-brass/5"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                      on
                        ? conflicted
                          ? "border-ember bg-ember/80 text-cream"
                          : "border-brass bg-brass text-felt-deep"
                        : "border-cream/40 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span>
                    <span className="text-sm text-cream">{r.label}</span>
                    <span className="ml-2 text-xs text-cream/80">{r.description}</span>
                    {conflicted && <span className="sr-only"> Conflicts with another selected rule.</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {conflicts.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2" role="alert">
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-ember">
                  {c.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Free-text (AI) house rules - Phase 3 */}
      {game && supportsAIRules(game) && (
        <div className="felt-panel rounded-xl p-4">
          <h3 className="plaque-header mb-1 text-xs text-brass">Write your own rule - in plain English</h3>
          <p className="mb-3 text-xs text-cream/80">
            e.g. “twos are wild”, “queens reverse”, “playing a 7 lets you go again”. The AI turns it into a real rule.
          </p>
          <div className="flex gap-2">
            <label htmlFor="custom-rule" className="sr-only">Custom house rule</label>
            <input
              id="custom-rule"
              value={ruleInput}
              onChange={(e) => setRuleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomRule()}
              placeholder="Type a house rule…"
              maxLength={200}
              aria-invalid={parseError ? true : undefined}
              aria-describedby={parseError ? "parse-rule-error" : undefined}
              className="felt-panel min-h-8 min-w-0 flex-1 rounded-full px-4 py-2 text-sm text-cream placeholder:text-cream/50"
            />
            <Button variant="quiet" size="md" disabled={parsing || !ruleInput.trim()} onClick={addCustomRule} aria-busy={parsing}>
              {parsing ? "Reading…" : "Add"}
            </Button>
          </div>
          {parseError && <p id="parse-rule-error" role="alert" className="mt-2 text-xs text-ember">{parseError}</p>}
          {customRules.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {customRules.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-brass/5 px-3 py-1.5">
                  <span className="text-sm text-cream">
                    “{r.text}” <span className="text-brass">· {r.summary}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomRules((prev) => prev.filter((_, j) => j !== i))}
                    className="min-h-6 text-xs text-cream/80 hover:text-ember"
                    aria-label={`Remove rule ${r.text}`}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button size="lg" disabled={!canStart} onClick={() => game && onStart(game, [...rules], customRules.map((r) => r.text))}>
          {game ? `Deal ${meta?.name}` : "Pick a game"}
        </Button>
        {game && !fits && (
          <p className="text-xs text-ember" role="status">
            {meta?.name} needs {meta?.minPlayers}–{meta?.maxPlayers} players.
          </p>
        )}
      </div>
    </div>
  );
}
