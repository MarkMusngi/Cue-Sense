// Undo and redo for the table editor, as a pure reducer (no React).
// The editor commits once per gesture, so one drag is one undo step.

import type { DrillLayout } from "@/lib/api-client";

export const HISTORY_LIMIT = 100;

export type LayoutHistory = {
  past: DrillLayout[];
  present: DrillLayout;
  future: DrillLayout[];
  // What reset returns to: the layout the editor was given.
  baseline: DrillLayout;
};

export type HistoryAction =
  | { type: "commit"; layout: DrillLayout }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "replace"; layout: DrillLayout };

export function createHistory(layout: DrillLayout): LayoutHistory {
  return { past: [], present: layout, future: [], baseline: layout };
}

export function canUndo(history: LayoutHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: LayoutHistory): boolean {
  return history.future.length > 0;
}

/** Layouts are plain JSON, so structural equality is enough. */
export function sameLayout(a: DrillLayout, b: DrillLayout): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function historyReducer(history: LayoutHistory, action: HistoryAction): LayoutHistory {
  switch (action.type) {
    case "commit":
      return commit(history, action.layout);
    case "undo": {
      if (!canUndo(history)) {
        return history;
      }
      const previous = history.past[history.past.length - 1];
      return {
        ...history,
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      };
    }
    case "redo": {
      if (!canRedo(history)) {
        return history;
      }
      const [next, ...rest] = history.future;
      return {
        ...history,
        past: [...history.past, history.present],
        present: next,
        future: rest,
      };
    }
    case "reset":
      return commit(history, history.baseline);
    case "replace":
      return createHistory(action.layout);
  }
}

function commit(history: LayoutHistory, layout: DrillLayout): LayoutHistory {
  if (sameLayout(layout, history.present)) {
    return history;
  }
  return {
    ...history,
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: layout,
    future: [],
  };
}
