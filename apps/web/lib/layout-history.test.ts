import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  historyReducer,
  sameLayout,
} from "@/lib/layout-history";

function layoutAt(x: number): DrillLayout {
  return {
    schema_version: 2,
    table: { kind: "pool", size_ft: 9 },
    cue_ball: { id: "ball_0", x, y: 2 },
    object_balls: [],
  };
}

describe("historyReducer", () => {
  it("commits a change as one undo step and clears redo", () => {
    let history = createHistory(layoutAt(1));
    history = historyReducer(history, { type: "commit", layout: layoutAt(2) });
    history = historyReducer(history, { type: "undo" });
    expect(canRedo(history)).toBe(true);

    history = historyReducer(history, { type: "commit", layout: layoutAt(3) });

    expect(history.present).toEqual(layoutAt(3));
    expect(canRedo(history)).toBe(false);
    expect(history.past).toEqual([layoutAt(1)]);
  });

  it("ignores a commit equal to the present layout", () => {
    const history = createHistory(layoutAt(1));
    expect(historyReducer(history, { type: "commit", layout: layoutAt(1) })).toBe(history);
  });

  it("undoes and redoes", () => {
    let history = createHistory(layoutAt(1));
    history = historyReducer(history, { type: "commit", layout: layoutAt(2) });
    history = historyReducer(history, { type: "undo" });
    expect(history.present).toEqual(layoutAt(1));
    expect(canUndo(history)).toBe(false);

    history = historyReducer(history, { type: "redo" });
    expect(history.present).toEqual(layoutAt(2));
    expect(canRedo(history)).toBe(false);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const history = createHistory(layoutAt(1));
    expect(historyReducer(history, { type: "undo" })).toBe(history);
    expect(historyReducer(history, { type: "redo" })).toBe(history);
  });

  it("resets to the layout the editor was given, as an undoable step", () => {
    let history = createHistory(layoutAt(1));
    history = historyReducer(history, { type: "commit", layout: layoutAt(2) });
    history = historyReducer(history, { type: "reset" });
    expect(history.present).toEqual(layoutAt(1));

    history = historyReducer(history, { type: "undo" });
    expect(history.present).toEqual(layoutAt(2));
  });

  it("replaces the whole history, including the baseline", () => {
    let history = createHistory(layoutAt(1));
    history = historyReducer(history, { type: "commit", layout: layoutAt(2) });
    history = historyReducer(history, { type: "replace", layout: layoutAt(5) });

    expect(history).toEqual(createHistory(layoutAt(5)));
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let history = createHistory(layoutAt(0));
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      history = historyReducer(history, { type: "commit", layout: layoutAt(i / 100) });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("sameLayout", () => {
  it("compares layouts by content", () => {
    expect(sameLayout(layoutAt(1), layoutAt(1))).toBe(true);
    expect(sameLayout(layoutAt(1), layoutAt(2))).toBe(false);
  });
});
