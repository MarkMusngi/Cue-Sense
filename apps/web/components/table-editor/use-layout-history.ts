import { useRef, useState } from "react";

import type { DrillLayout } from "@/lib/api-client";
import {
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
  sameLayout,
  type HistoryAction,
  type LayoutHistory,
} from "@/lib/layout-history";

/**
 * Undo and redo for a controlled editor. Every change is reported through onChange.
 * A layout from the parent that the editor did not emit (for example another drill
 * version) replaces the history, so the parent never manages it.
 */
export function useLayoutHistory(layout: DrillLayout, onChange?: (layout: DrillLayout) => void) {
  const [history, setHistory] = useState(() => createHistory(layout));

  // Adjusting state while rendering, as React recommends for props-derived state.
  let current = history;
  if (!sameLayout(layout, history.present)) {
    current = historyReducer(history, { type: "replace", layout });
    setHistory(current);
  }

  // The newest history, ahead of the next render, so two commits in one event (for
  // example a keyboard repeat) build on each other and no edit is lost.
  const latest = useRef<LayoutHistory>(current);
  latest.current = current;

  function apply(action: HistoryAction) {
    const before = latest.current;
    const next = historyReducer(before, action);
    if (next === before) {
      return;
    }
    latest.current = next;
    setHistory(next);
    if (next.present !== before.present) {
      onChange?.(next.present);
    }
  }

  return {
    present: current.present,
    /** The newest layout, including commits made earlier in the same event. */
    getPresent: () => latest.current.present,
    /** Commit a layout, or an update applied to the newest one. */
    commit: (next: DrillLayout | ((present: DrillLayout) => DrillLayout)) =>
      apply({
        type: "commit",
        layout: typeof next === "function" ? next(latest.current.present) : next,
      }),
    undo: () => apply({ type: "undo" }),
    redo: () => apply({ type: "redo" }),
    reset: () => apply({ type: "reset" }),
    canUndo: canUndo(current),
    canRedo: canRedo(current),
    // Reset returns to the layout the editor was given.
    canReset: !sameLayout(current.present, current.baseline),
  };
}
