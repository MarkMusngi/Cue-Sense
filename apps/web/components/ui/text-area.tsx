"use client";

import { useId, type TextareaHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hint?: string;
  /** Shown under the box and announced with it; marks it invalid. */
  error?: string;
  "data-testid"?: string;
};

/** A labelled multi-line input whose hint and error are tied to it for screen readers. */
export function TextArea({
  label,
  hint,
  error,
  className,
  rows = 4,
  "data-testid": testId = "text-area",
  ...rest
}: TextAreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-testid={testId}
        className={cx(
          "rounded-[10px] bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-text",
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
