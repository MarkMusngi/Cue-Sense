import { useState } from "react";

import type { Layout } from "@/lib/layout";
import {
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
  type HistoryAction,
} from "@/lib/layout-history";

/**
 * Undo and redo for a controlled editor. Every change is reported through onChange.
 * A layout from the parent that the editor did not emit (for example another drill
 * version) replaces the history, so the parent never manages it.
 */
export function useLayoutHistory(layout: Layout, onChange?: (layout: Layout) => void) {
  const [history, setHistory] = useState(() => createHistory(layout));

  // Adjusting state while rendering, as React recommends for props-derived state.
  let current = history;
  if (layout !== history.present) {
    current = historyReducer(history, { type: "replace", layout });
    setHistory(current);
  }

  function apply(action: HistoryAction) {
    const next = historyReducer(current, action);
    if (next !== current) {
      setHistory(next);
      if (next.present !== current.present) {
        onChange?.(next.present);
      }
    }
  }

  return {
    present: current.present,
    commit: (next: Layout) => apply({ type: "commit", layout: next }),
    undo: () => apply({ type: "undo" }),
    redo: () => apply({ type: "redo" }),
    reset: () => apply({ type: "reset" }),
    canUndo: canUndo(current),
    canRedo: canRedo(current),
  };
}
