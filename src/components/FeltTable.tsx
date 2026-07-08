import { PlayerSeat } from "./PlayerSeat";
import type { SeatedPlayer } from "@/lib/types";

// The card table itself. Seats arrange around a felt oval; the deck rests at
// center. Generous negative space, no boxy panels - the green does the framing.
// Empty seats fill out to a minimum so a lone host still feels seated at a table.

const MIN_SEATS = 4;
const MAX_SEATS = 10;

/** Position seats evenly around an ellipse, starting from the bottom (the "you" chair). */
function seatPosition(index: number, total: number): { top: string; left: string } {
  // Start at the bottom-center and go clockwise, so the first player sits nearest the viewer.
  const angle = Math.PI / 2 + (index / total) * Math.PI * 2;
  // The felt oval is drawn at inset-[14%] (rim ≈ 36% radius). Seat at ~38% so the
  // avatars perch on the brass rail rather than floating in the outer margin.
  const rx = 38; // % of container width
  const ry = 38; // % of container height
  const left = 50 + rx * Math.cos(angle);
  const top = 50 + ry * Math.sin(angle);
  return { top: `${top}%`, left: `${left}%` };
}

export function FeltTable({ players }: { players: SeatedPlayer[] }) {
  const seatCount = Math.min(MAX_SEATS, Math.max(MIN_SEATS, players.length));
  const seats: (SeatedPlayer | null)[] = Array.from(
    { length: seatCount },
    (_, i) => players[i] ?? null,
  );

  return (
    // Padding reserves room for the seats, which sit centered on the oval's edge
    // and would otherwise hang half-off the container (and scroll on mobile).
    <div className="mx-auto w-full max-w-2xl px-12 py-12">
      {/* The oval rail - a raised felt table with a brass hairline and inner well. */}
      <div className="relative mx-auto aspect-4/3 w-full">
        <div
          className="absolute inset-[14%] rounded-[50%] border border-brass/25"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 30%, color-mix(in oklab, var(--color-felt) 92%, white 8%), var(--color-felt-dark) 78%)",
            boxShadow:
              "inset 0 2px 30px rgba(0,0,0,0.45), inset 0 0 0 6px color-mix(in oklab, var(--color-felt-dark) 60%, black 40%)",
          }}
        />

        {/* The deck at center - two stacked card backs, the calm before the deal. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-16 w-12">
            <div className="card-back absolute inset-0 rotate-[-6deg] rounded-md shadow-lg" />
            <div className="card-back absolute inset-0 rotate-[4deg] rounded-md shadow-lg" />
          </div>
        </div>

        {/* Seats around the rail. */}
        {seats.map((player, i) => {
          const pos = seatPosition(i, seatCount);
          return (
            <div
              key={player?.id ?? `empty-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={pos}
            >
              <PlayerSeat player={player} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
