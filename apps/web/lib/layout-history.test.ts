import { describe, expect, it } from "vitest";

import type { Layout } from "@/lib/layout";
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
} from "@/lib/layout-history";
import { sampleLayout } from "@/lib/sample-layouts";

function withCueX(x: number): Layout {
  const layout = sampleLayout();
  layout.cue_ball.x = x;
  return layout;
}

describe("historyReducer", () => {
  it("starts with nothing to undo or redo", () => {
    const history = createHistory(sampleLayout());

    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("undoes and redoes commits in order", () => {
    let history = createHistory(withCueX(1));
    history = historyReducer(history, { type: "commit", layout: withCueX(1.5) });
    history = historyReducer(history, { type: "commit", layout: withCueX(1.8) });

    history = historyReducer(history, { type: "undo" });
    expect(history.present.cue_ball.x).toBe(1.5);
    history = historyReducer(history, { type: "undo" });
    expect(history.present.cue_ball.x).toBe(1);
    expect(canUndo(history)).toBe(false);

    history = historyReducer(history, { type: "redo" });
    expect(history.present.cue_ball.x).toBe(1.5);
    expect(canRedo(history)).toBe(true);
  });

  it("drops the redo stack on a new commit", () => {
    let history = createHistory(withCueX(1));
    history = historyReducer(history, { type: "commit", layout: withCueX(1.5) });
    history = historyReducer(history, { type: "undo" });

    history = historyReducer(history, { type: "commit", layout: withCueX(1.2) });

    expect(canRedo(history)).toBe(false);
    expect(history.present.cue_ball.x).toBe(1.2);
  });

  it("ignores a commit equal to the present layout", () => {
    const history = createHistory(withCueX(1));

    expect(historyReducer(history, { type: "commit", layout: withCueX(1) })).toBe(history);
  });

  it("ignores undo and redo with nothing to move", () => {
    const history = createHistory(withCueX(1));

    expect(historyReducer(history, { type: "undo" })).toBe(history);
    expect(historyReducer(history, { type: "redo" })).toBe(history);
  });

  it("keeps at most HISTORY_LIMIT undo steps", () => {
    let history = createHistory(withCueX(0.5));
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
      history = historyReducer(history, { type: "commit", layout: withCueX(1 + i / 1000) });
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });

  it("reset returns to the baseline as an undoable step", () => {
    let history = createHistory(withCueX(1));
    history = historyReducer(history, { type: "commit", layout: withCueX(1.5) });

    history = historyReducer(history, { type: "reset" });
    expect(history.present.cue_ball.x).toBe(1);

    history = historyReducer(history, { type: "undo" });
    expect(history.present.cue_ball.x).toBe(1.5);
  });

  it("replace starts a fresh history with a new baseline", () => {
    let history = createHistory(withCueX(1));
    history = historyReducer(history, { type: "commit", layout: withCueX(1.5) });

    history = historyReducer(history, { type: "replace", layout: withCueX(1.7) });

    expect(history.present.cue_ball.x).toBe(1.7);
    expect(history.baseline.cue_ball.x).toBe(1.7);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });
});
