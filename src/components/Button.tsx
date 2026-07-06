import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "brass" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "select-none disabled:opacity-45 disabled:pointer-events-none no-underline";

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

const variants: Record<Variant, string> = {
  brass: "btn-brass",
  quiet: "btn-quiet",
};

function classesFor(variant: Variant, size: Size, extra?: string) {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra ?? ""}`.trim();
}

export function Button({
  variant = "brass",
  size = "md",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button className={classesFor(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "brass",
  size = "md",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ComponentProps<typeof Link>) {
  return (
    <Link className={classesFor(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
