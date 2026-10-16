// Button classes in a plain module, so server components (a link that looks like a
// button) can use them. Button itself is a client component, and a server component
// cannot call a function exported from one.

import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-chalk text-chalk-ink font-semibold hover:brightness-110",
  secondary: "border-control bg-surface text-text hover:bg-raised",
  ghost: "border-transparent bg-transparent text-muted hover:bg-raised hover:text-text",
};

/** Classes for anything that looks like a button: 44 px tall, rounded. */
export function buttonClasses(variant: ButtonVariant = "secondary", className?: string): string {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4",
    "text-[15px] font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTS[variant],
    className,
  );
}
