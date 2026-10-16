"use client";

import { cx } from "@/lib/cx";

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  /** Names the group for screen readers, e.g. "Time range". */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** A small set of mutually exclusive choices shown side by side. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid="segmented-control"
      className={cx(
        "inline-flex rounded-[12px] border border-control bg-surface p-[3px]",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            data-testid={`segmented-control-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cx(
              "min-h-11 rounded-[9px] px-3.5 text-sm",
              isSelected
                ? "bg-raised font-semibold text-text shadow-[inset_0_0_0_1px_var(--control)]"
                : "font-medium text-muted hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
