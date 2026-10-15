"use client";

import { useSyncExternalStore } from "react";

import { cx } from "@/lib/cx";
import { applyTheme, type Theme } from "@/lib/theme";

// The theme lives on <html data-theme>, set before React started. Reading it as an
// external store keeps every toggle on the page in step.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
// The server cannot know the theme, so it renders a neutral label.
const getServerTheme = (): Theme | null => null;

/** Switches between the dark and light themes and remembers the choice. */
export function ThemeToggle({
  className,
  "data-testid": testId = "theme-toggle",
}: {
  className?: string;
  "data-testid"?: string;
}) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, getServerTheme);

  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={theme ? `Switch to ${next} theme` : "Switch theme"}
      onClick={() => applyTheme(next)}
      className={cx(
        "inline-flex size-11 items-center justify-center rounded-[10px] text-muted hover:bg-raised hover:text-text",
        className,
      )}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        {theme === "light" ? (
          <path d="M14.5 12.5 A6 6 0 0 1 7.5 5.5 A6.5 6.5 0 1 0 14.5 12.5 Z" fill="currentColor" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.5" fill="currentColor" />
            <path
              d="M10 2 V4 M10 16 V18 M2 10 H4 M16 10 H18 M4.3 4.3 L5.7 5.7 M14.3 14.3 L15.7 15.7 M4.3 15.7 L5.7 14.3 M14.3 5.7 L15.7 4.3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}
