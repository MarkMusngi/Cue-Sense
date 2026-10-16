"use client";

import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Set for a toggle chip, such as a filter; leave out for a plain action chip. */
  pressed?: boolean;
  "data-testid"?: string;
};

/** A rounded filter or tag control, 44 px tall so it is easy to tap. */
export function Chip({ pressed, className, "data-testid": testId = "chip", ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium",
        pressed
          ? "border-text bg-text text-bg"
          : "border-control bg-transparent text-muted hover:text-text",
        className,
      )}
      {...rest}
    />
  );
}
