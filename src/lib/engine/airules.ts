// Phase 3a - the structured, executable rule representation and its deterministic
// executor. NO AI here: this is the schema an LLM will later target (Phase 3b) and
// the engine that runs rules against game state. It must be correct on its own.
//
// Scope: Crazy Eights "card_played" rules - the natural home for free-text rules.
// A rule matches a played card (by rank and/or suit) and applies bounded effects
// the engine already understands (skip / reverse / draw / wild / play-again).

import type { Card, Suit } from "./cards";

export type RuleEffect =
  | { kind: "skip"; n: number }
  | { kind: "reverse" }
  | { kind: "draw"; n: number } // the next player draws n
  | { kind: "wild" } // the card is wild - player declares a suit
  | { kind: "play_again" }; // the player takes another turn

export type RuleDuration = "permanent" | { rounds: number };

export interface AIRule {
  id: string;
  raw: string; // the original plain-English text, kept for display
  game: string; // "crazyeights"
  trigger: "card_played";
  match: { rank?: number; suit?: Suit };
  effects: RuleEffect[];
  duration: RuleDuration;
  /** Runtime bookkeeping: the play index when this rule became active (for expiry). */
  addedAtPlay?: number;
}

const SUITS = ["S", "H", "D", "C"];
const KINDS = ["skip", "reverse", "draw", "wild", "play_again"];

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

/** Deterministic id from the normalized rule text (so the cache + dedupe are stable). */
export function ruleId(text: string): string {
  const norm = normalizeText(text);
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "r" + (h >>> 0).toString(36);
}

export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");
}

/**
 * Validate an untrusted (LLM-produced) object into a safe AIRule, or null if it's
 * unusable. This is the guardrail between the model and the deterministic engine.
 */
export function validateAIRule(raw: unknown, text: string, game = "crazyeights"): AIRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.trigger !== "card_played") return null;

  const m = (o.match ?? {}) as Record<string, unknown>;
  const match: { rank?: number; suit?: Suit } = {};
  if (typeof m.rank === "number" && m.rank >= 1 && m.rank <= 13) match.rank = Math.round(m.rank);
  if (typeof m.suit === "string" && SUITS.includes(m.suit)) match.suit = m.suit as Suit;
  if (match.rank === undefined && match.suit === undefined) return null; // must match something

  const effects: RuleEffect[] = [];
  if (Array.isArray(o.effects)) {
    for (const e of o.effects as Record<string, unknown>[]) {
      if (!e || typeof e.kind !== "string" || !KINDS.includes(e.kind)) continue;
      if (e.kind === "skip") effects.push({ kind: "skip", n: clampInt(e.n, 1, 3, 1) });
      else if (e.kind === "draw") effects.push({ kind: "draw", n: clampInt(e.n, 1, 8, 2) });
      else if (e.kind === "reverse") effects.push({ kind: "reverse" });
      else if (e.kind === "wild") effects.push({ kind: "wild" });
      else if (e.kind === "play_again") effects.push({ kind: "play_again" });
    }
  }
  if (effects.length === 0) return null;

  let duration: RuleDuration = "permanent";
  const d = o.duration as Record<string, unknown> | string | undefined;
  if (d && typeof d === "object" && typeof d.rounds === "number") duration = { rounds: clampInt(d.rounds, 1, 50, 1) };

  return { id: ruleId(text), raw: text.trim().slice(0, 140), game, trigger: "card_played", match, effects, duration };
}

export function matchesCard(rule: AIRule, card: Card): boolean {
  if (rule.match.rank !== undefined && rule.match.rank !== card.r) return false;
  if (rule.match.suit !== undefined && rule.match.suit !== card.s) return false;
  return true;
}

export interface AggregatedEffects {
  skip: number;
  reverse: boolean;
  draw: number;
  wild: boolean;
  playAgain: boolean;
}

/** Rules still active given the current play count (round-limited rules expire). */
export function activeRules(rules: AIRule[], plays: number, playerCount: number): AIRule[] {
  return rules.filter((r) => {
    if (r.duration === "permanent") return true;
    const start = r.addedAtPlay ?? 0;
    return plays - start < r.duration.rounds * Math.max(1, playerCount);
  });
}

/** Aggregate the effects that fire when `card` is played, given active rules. */
export function aiCardEffects(card: Card, rules: AIRule[]): AggregatedEffects {
  const agg: AggregatedEffects = { skip: 0, reverse: false, draw: 0, wild: false, playAgain: false };
  for (const rule of rules) {
    if (!matchesCard(rule, card)) continue;
    for (const e of rule.effects) {
      if (e.kind === "skip") agg.skip += e.n;
      else if (e.kind === "reverse") agg.reverse = !agg.reverse;
      else if (e.kind === "draw") agg.draw += e.n;
      else if (e.kind === "wild") agg.wild = true;
      else if (e.kind === "play_again") agg.playAgain = true;
    }
  }
  return agg;
}

/** Is this card wild because of an active rule (independent of being an 8)? */
export function isWildByRule(card: Card, rules: AIRule[]): boolean {
  return rules.some((r) => matchesCard(r, card) && r.effects.some((e) => e.kind === "wild"));
}

export interface AIRuleConflict {
  ids: string[];
  reason: string;
}

/** Surface rules that fire on the same card - the table should agree, not silently stack. */
export function detectAIConflicts(rules: AIRule[]): AIRuleConflict[] {
  const byKey = new Map<string, AIRule[]>();
  for (const r of rules) {
    const k = `${r.match.rank ?? "*"}${r.match.suit ?? "*"}`;
    const arr = byKey.get(k) ?? [];
    arr.push(r);
    byKey.set(k, arr);
  }
  const conflicts: AIRuleConflict[] = [];
  for (const arr of byKey.values()) {
    if (arr.length > 1) {
      conflicts.push({
        ids: arr.map((r) => r.id),
        reason: `Multiple rules fire on the same card: ${arr.map((r) => `“${r.raw}”`).join(" and ")}.`,
      });
    }
  }
  return conflicts;
}

/** A short human summary of a rule's effects, for the plaque / chips. */
export function summarizeRule(rule: AIRule): string {
  const parts = rule.effects.map((e) => {
    if (e.kind === "skip") return `skip ${e.n}`;
    if (e.kind === "draw") return `draw ${e.n}`;
    if (e.kind === "reverse") return "reverse";
    if (e.kind === "wild") return "wild";
    return "play again";
  });
  return parts.join(" + ");
}
