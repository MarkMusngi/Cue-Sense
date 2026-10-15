"use client";

import { useId, type InputHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: string;
  /** Shown under the input and announced with it; marks the input invalid. */
  error?: string;
  "data-testid"?: string;
};

/** A labelled input whose hint and error are tied to it for screen readers. */
export function TextField({
  label,
  hint,
  error,
  className,
  "data-testid": testId = "text-field",
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-testid={testId}
        className={cx(
          "min-h-11 rounded-[10px] bg-surface px-3 text-[15px] text-text",
          error ? "border-[1.5px] border-miss" : "border border-control",
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} data-testid={`${testId}-error`} className="text-xs text-miss">
          {error}
        </p>
      )}
    </div>
  );
}
