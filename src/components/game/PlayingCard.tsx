import { RANK_LABEL, SUIT_SYMBOL, isRed, type Card } from "@/lib/engine/cards";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-14 w-10 text-sm",
  md: "h-20 w-14 text-lg",
  lg: "h-28 w-20 text-2xl",
};

/** A single playing card — cream face with ink/ember pips, or the ember card back. */
export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  onClick,
  selected = false,
  dimmed = false,
  className = "",
}: {
  card?: Card;
  faceDown?: boolean;
  size?: Size;
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  className?: string;
}) {
  const base = `relative shrink-0 rounded-lg ${SIZES[size]} ${className}`;
  const interactive = onClick ? "cursor-pointer" : "";
  const lift = selected ? "-translate-y-3" : onClick ? "hover:-translate-y-2" : "";
  const dim = dimmed ? "opacity-45" : "";

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`card-back deal-in shadow-lg transition-transform ${base} ${interactive} ${lift} ${dim} ${selected ? "ring-2 ring-brass-bright" : ""}`}
        aria-label="Face-down card"
      />
    );
  }

  const red = isRed(card.s);
  const color = red ? "text-ember" : "text-ink";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`deal-in flex flex-col justify-between bg-cream p-1.5 shadow-lg transition-transform ${base} ${interactive} ${lift} ${dim} ${
        selected ? "ring-2 ring-brass-bright" : ""
      }`}
      aria-label={`${RANK_LABEL[card.r]} of ${card.s}`}
    >
      <span className={`font-display font-semibold leading-none ${color}`}>
        {RANK_LABEL[card.r]}
        <span className="ml-0.5">{SUIT_SYMBOL[card.s]}</span>
      </span>
      <span className={`self-center ${color} opacity-90`} style={{ fontSize: "1.6em" }}>
        {SUIT_SYMBOL[card.s]}
      </span>
      <span className={`rotate-180 self-end font-display font-semibold leading-none ${color}`}>
        {RANK_LABEL[card.r]}
        <span className="ml-0.5">{SUIT_SYMBOL[card.s]}</span>
      </span>
    </div>
  );
}
