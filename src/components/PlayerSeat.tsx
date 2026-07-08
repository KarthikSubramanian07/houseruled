import type { SeatedPlayer } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** A seat around the table - a filled seat for a present player, or an empty one. */
export function PlayerSeat({ player }: { player: SeatedPlayer | null }) {
  if (!player) {
    return (
      <div className="flex w-24 flex-col items-center gap-1.5 text-center">
        <div
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-cream/25 text-cream/30"
        >
          <span className="text-xl leading-none">+</span>
        </div>
        <span className="text-xs text-cream/35">open seat</span>
      </div>
    );
  }

  return (
    <div className="deal-in flex w-24 flex-col items-center gap-1.5 text-center">
      <div className="relative">
        <div
          className="grid h-12 w-12 place-items-center rounded-full bg-felt-dark text-sm font-semibold text-cream shadow-md ring-2 ring-brass/70"
          title={player.name}
        >
          {initials(player.name)}
        </div>
        {player.isHost && (
          <span
            className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brass text-[10px] text-felt-deep shadow"
            title="Host"
            aria-label="Host"
          >
            ★
          </span>
        )}
      </div>
      <span className="max-w-24 truncate text-xs font-medium text-cream">
        {player.name}
      </span>
      {player.isSelf && (
        <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brass-bright">
          you
        </span>
      )}
    </div>
  );
}
