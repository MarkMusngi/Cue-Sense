"use client";

import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  "data-testid"?: string;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-chalk text-chalk-ink font-semibold hover:brightness-110",
  secondary: "border-control bg-surface text-text hover:bg-raised",
  ghost: "border-transparent bg-transparent text-muted hover:bg-raised hover:text-text",
};

/** The app's button: at least 44 px tall, never a form submit unless asked. */
export function Button({
  variant = "secondary",
  type = "button",
  className,
  "data-testid": testId = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4",
        "text-[15px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
