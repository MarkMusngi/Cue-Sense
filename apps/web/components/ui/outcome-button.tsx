"use client";

import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

// Attempt outcomes use the API's values; the labels are what a player says at the table.
export type Outcome = "success" | "fail" | "partial";

type OutcomeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  outcome: Outcome;
  size?: "large" | "medium";
};

const STYLE: Record<Outcome, { label: string; className: string }> = {
  success: { label: "Make", className: "border-transparent bg-chalk text-chalk-ink" },
  fail: { label: "Miss", className: "border-miss bg-miss-soft text-miss" },
  partial: { label: "Partial", className: "border-control bg-raised text-text" },
};

/** Logs one attempt. Make is filled, Miss is outlined, so they differ in more than colour. */
export function OutcomeButton({ outcome, size = "large", className, ...rest }: OutcomeButtonProps) {
  const { label, className: look } = STYLE[outcome];
  return (
    <button
      type="button"
      data-testid={`outcome-${outcome}`}
      className={cx(
        "flex flex-col items-center justify-center gap-1 rounded-[18px] border-2",
        "font-display font-bold uppercase tracking-[0.06em]",
        "transition-transform active:scale-[0.98] disabled:opacity-45",
        size === "large" ? "min-h-32 text-[26px] sm:text-[30px]" : "min-h-14 text-xl",
        look,
        className,
      )}
      {...rest}
    >
      {size === "large" && <OutcomeIcon outcome={outcome} />}
      {label}
    </button>
  );
}

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      {outcome === "success" && (
        <path
          d="M6 14 L12 20 L22 8"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {outcome === "fail" && (
        <path d="M8 8 L20 20 M20 8 L8 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      )}
      {outcome === "partial" && (
        <>
          <path d="M14 3 L25 14 L14 25 L3 14 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M14 3 L3 14 L14 25 Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
