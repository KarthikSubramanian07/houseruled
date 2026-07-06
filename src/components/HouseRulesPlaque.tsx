// The signature element. A small brass-trimmed scorecard pinned to the felt —
// always visible, styled like a plaque, not a generic collapsible drawer. This is
// where the design spends its visual budget. In Phase 0 it holds the empty state;
// Phase 2 fills it with toggle rules and Phase 3 with AI-parsed house rules.

export interface HouseRule {
  id: string;
  text: string;
}

export function HouseRulesPlaque({ rules = [] }: { rules?: HouseRule[] }) {
  return (
    <aside
      className="plaque w-full max-w-xs px-5 pb-5 pt-6"
      aria-label="House rules"
    >
      <header className="mb-4 border-b border-brass-dim/40 pb-3 text-center">
        <h2 className="plaque-header text-sm text-brass-dim">House Rules</h2>
      </header>

      {rules.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="font-display text-lg leading-snug text-ink">
            The house plays it straight.
          </p>
          <p className="text-sm leading-relaxed text-ink/65">
            No custom rules yet. Soon you&apos;ll be able to bend the game to your
            table — twos wild, queens reverse, loser deals. For now, it&apos;s by
            the book.
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {rules.map((rule, i) => (
            <li key={rule.id} className="flex gap-3 text-sm leading-snug text-ink">
              <span className="tabular font-display font-semibold text-brass-dim">
                {i + 1}.
              </span>
              <span>{rule.text}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Faux ruled lines at the foot — the "scorecard" texture. */}
      <div aria-hidden className="mt-5 space-y-2 opacity-40">
        <div className="h-px w-full bg-ink/15" />
        <div className="h-px w-full bg-ink/15" />
      </div>
    </aside>
  );
}
