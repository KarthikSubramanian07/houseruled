import { RANK_LABEL, SUIT_SYMBOL, isRed, type Card } from "@/lib/engine/cards";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-14 w-10 text-sm",
  md: "h-[5.5rem] w-[3.9rem] text-lg",
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
  highlight = false,
  delay = 0,
  className = "",
}: {
  card?: Card;
  faceDown?: boolean;
  size?: Size;
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  highlight?: boolean;
  delay?: number;
  className?: string;
}) {
  const base = `relative shrink-0 rounded-lg ${SIZES[size]} ${className}`;
  const interactive = onClick ? "cursor-pointer" : "";
  const lift = selected ? "-translate-y-3" : onClick ? "hover:-translate-y-2" : "";
  const dim = dimmed ? "opacity-35 grayscale" : "";
  const ring = selected
    ? "ring-2 ring-brass-bright"
    : highlight
      ? "ring-2 ring-brass/60"
      : "";
  const style = delay ? { animationDelay: `${delay}ms` } : undefined;

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        style={style}
        className={`card-back deal-in shadow-lg transition-transform ${base} ${interactive} ${lift} ${dim} ${ring}`}
        aria-label="Face-down card"
      />
    );
  }

  if (card.j) {
    return (
      <div
        onClick={onClick}
        style={style}
        role={onClick ? "button" : undefined}
        className={`deal-in flex flex-col items-center justify-center gap-1 bg-cream p-1.5 shadow-lg transition-transform ${base} ${interactive} ${lift} ${dim} ${ring} ${highlight ? "card-playable" : ""}`}
        aria-label="Joker"
      >
        <span className="font-display text-xl leading-none text-brass">★</span>
        <span className="font-display text-[0.6em] uppercase tracking-widest text-ink/70">Joker</span>
      </div>
    );
  }

  const color = isRed(card.s) ? "text-ember" : "text-ink";
  return (
    <div
      onClick={onClick}
      style={style}
      role={onClick ? "button" : undefined}
      className={`deal-in flex flex-col justify-between bg-cream p-1.5 shadow-lg transition-transform ${base} ${interactive} ${lift} ${dim} ${ring} ${highlight ? "card-playable" : ""}`}
      aria-label={`${RANK_LABEL[card.r]} of ${card.s}`}
    >
      <span className={`font-display font-semibold leading-none ${color}`}>
        {RANK_LABEL[card.r]}
        <span className="ml-0.5">{SUIT_SYMBOL[card.s]}</span>
      </span>
      <span className={`self-center leading-none ${color} opacity-90`} style={{ fontSize: "1.3em" }}>
        {SUIT_SYMBOL[card.s]}
      </span>
      <span className={`self-end rotate-180 font-display font-semibold leading-none ${color}`}>
        {RANK_LABEL[card.r]}
        <span className="ml-0.5">{SUIT_SYMBOL[card.s]}</span>
      </span>
    </div>
  );
}
