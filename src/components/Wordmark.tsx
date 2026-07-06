import Link from "next/link";

/**
 * The Houseruled wordmark. Display serif, with a brass "ruled" underline that
 * nods at the house-rules idea. Used in the header and the hero.
 */
export function Wordmark({
  size = "md",
  asLink = true,
}: {
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}) {
  const scale =
    size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-xl" : "text-2xl";

  const mark = (
    <span
      className={`font-display font-semibold tracking-tight text-cream ${scale}`}
    >
      House
      <span className="relative text-brass">
        ruled
        {/* the brass "rule" under the word */}
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-brass/80"
        />
      </span>
    </span>
  );

  if (!asLink) return mark;
  return (
    <Link href="/" className="inline-flex items-center no-underline">
      {mark}
    </Link>
  );
}
