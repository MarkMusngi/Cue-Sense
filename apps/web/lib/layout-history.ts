// Undo and redo for the table editor, as a pure reducer (no React).
// The editor commits once per gesture, so one drag is one undo step.

import type { Layout } from "@/lib/layout";

export const HISTORY_LIMIT = 100;

export type LayoutHistory = {
  past: Layout[];
  present: Layout;
  future: Layout[];
  // What reset returns to: the layout the editor was given.
  baseline: Layout;
};

export type HistoryAction =
  | { type: "commit"; layout: Layout }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "replace"; layout: Layout };

export function createHistory(layout: Layout): LayoutHistory {
  return { past: [], present: layout, future: [], baseline: layout };
}

export function canUndo(history: LayoutHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: LayoutHistory): boolean {
  return history.future.length > 0;
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

function commit(history: LayoutHistory, layout: Layout): LayoutHistory {
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

function sameLayout(a: Layout, b: Layout): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
