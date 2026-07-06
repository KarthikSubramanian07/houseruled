// Phase 2 — curated, pre-validated house-rule toggles per game. These are simple
// declarative flags the engine reads (NOT the richer Phase 3 free-text schema).
// Conflicts are hardcoded via `group` (mutually exclusive) and `requires`
// (dependency), so the picker can warn before a game ever starts.

export interface HouseRule {
  id: string;
  game: string;
  label: string;
  description: string;
  /** Rules sharing a group are mutually exclusive (they touch the same thing). */
  group?: string;
  /** Rule ids that must also be on for this one to make sense. */
  requires?: string[];
  /** On by default when a game is created. */
  default?: boolean;
}

const RULES: HouseRule[] = [
  // ── War ─────────────────────────────────────────────────────────────────────
  { id: "war-aces-low", game: "war", label: "Aces low", description: "Aces count as the lowest card instead of the highest." },
  { id: "war-one-card", game: "war", label: "Quick wars", description: "On a tie, bury one card instead of three." },

  // ── Go Fish ──────────────────────────────────────────────────────────────────
  { id: "gofish-ask-anything", game: "gofish", label: "Ask for anything", description: "You may ask for a rank even if you don't hold it." },
  { id: "gofish-give-one", game: "gofish", label: "Hand over one", description: "A matched player gives just one card, not all of them." },

  // ── Old Maid ──────────────────────────────────────────────────────────────────
  { id: "oldmaid-draw-right", game: "oldmaid", label: "Draw from the right", description: "Draw from your right-hand neighbor instead of your left." },
  { id: "oldmaid-no-auto-discard", game: "oldmaid", label: "No opening discard", description: "Keep your dealt pairs — only discard pairs made by drawing." },

  // ── Crazy Eights (the showcase) ───────────────────────────────────────────────
  { id: "ce8-twos-draw-two", game: "crazyeights", label: "Twos draw two", description: "Play a 2 and the next player draws two cards.", group: "twos" },
  { id: "ce8-twos-skip", game: "crazyeights", label: "Twos skip", description: "Play a 2 to skip the next player.", group: "twos" },
  { id: "ce8-stack-twos", game: "crazyeights", label: "Stack the draws", description: "A player facing a draw-two can play their own 2 to pass it on, stacking the total.", requires: ["ce8-twos-draw-two"] },
  { id: "ce8-queens-skip", game: "crazyeights", label: "Queens skip", description: "Play a Queen to skip the next player.", group: "queens" },
  { id: "ce8-queens-reverse", game: "crazyeights", label: "Queens reverse", description: "Play a Queen to reverse the direction of play.", group: "queens" },
  { id: "ce8-jacks-skip", game: "crazyeights", label: "Jacks skip", description: "Play a Jack to skip the next player." },
  { id: "ce8-aces-reverse", game: "crazyeights", label: "Aces reverse", description: "Play an Ace to reverse the direction of play.", group: "aces" },
  { id: "ce8-aces-skip", game: "crazyeights", label: "Aces skip", description: "Play an Ace to skip the next player.", group: "aces" },
  { id: "ce8-kings-skip", game: "crazyeights", label: "Kings skip", description: "Play a King to skip the next player." },
  { id: "ce8-draw-until-play", game: "crazyeights", label: "Draw until you can play", description: "Can't play? Keep drawing until you can, then play it.", group: "draw-mode" },

  // ── Blackjack ──────────────────────────────────────────────────────────────────
  { id: "bj-dealer-hits-soft-17", game: "blackjack", label: "Dealer hits soft 17", description: "The dealer hits on a soft 17 (Ace + 6) instead of standing." },
  { id: "bj-five-card-charlie", game: "blackjack", label: "Five-card Charlie", description: "Five cards without busting is an automatic win." },
  { id: "bj-dealer-wins-ties", game: "blackjack", label: "Dealer wins ties", description: "A tie goes to the dealer instead of pushing." },
];

export function rulesFor(game: string): HouseRule[] {
  return RULES.filter((r) => r.game === game);
}

export function getRule(id: string): HouseRule | undefined {
  return RULES.find((r) => r.id === id);
}

export interface Conflict {
  ids: string[];
  reason: string;
}

/**
 * Find conflicts in a set of active rule ids: two rules from the same group, or a
 * rule whose requirement isn't also active. Returns an empty list when valid.
 */
export function detectConflicts(game: string, activeIds: string[]): Conflict[] {
  const active = new Set(activeIds);
  const rules = rulesFor(game).filter((r) => active.has(r.id));
  const conflicts: Conflict[] = [];

  // Mutually exclusive groups.
  const byGroup = new Map<string, HouseRule[]>();
  for (const r of rules) {
    if (!r.group) continue;
    const arr = byGroup.get(r.group) ?? [];
    arr.push(r);
    byGroup.set(r.group, arr);
  }
  for (const [, arr] of byGroup) {
    if (arr.length > 1) {
      conflicts.push({
        ids: arr.map((r) => r.id),
        reason: `${arr.map((r) => `"${r.label}"`).join(" and ")} both change the same card — pick one.`,
      });
    }
  }

  // Unmet dependencies.
  for (const r of rules) {
    for (const dep of r.requires ?? []) {
      if (!active.has(dep)) {
        const depRule = getRule(dep);
        conflicts.push({
          ids: [r.id, dep],
          reason: `"${r.label}" needs "${depRule?.label ?? dep}" turned on too.`,
        });
      }
    }
  }

  return conflicts;
}

/** Only ids that belong to the game are kept (defends the engine from junk input). */
export function sanitizeRules(game: string, activeIds: string[]): string[] {
  const valid = new Set(rulesFor(game).map((r) => r.id));
  return activeIds.filter((id) => valid.has(id));
}
