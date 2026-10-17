import { describe, expect, it } from "vitest";

import type {
  AttemptRead,
  AttemptSummary,
  DrillScoring,
  Outcome,
  SetProgress,
} from "@/lib/api-client";
import {
  displayProgress,
  hasFailed,
  initialRunnerState,
  lastCounted,
  lastLoggedText,
  marksFor,
  runnerReducer,
  runTotals,
  statusFor,
  undoTarget,
  type RunnerAction,
  type RunnerState,
} from "@/lib/runner-state";
import { computeSetProgress } from "@/lib/set-progress";

const MAKE_3_OF_5: DrillScoring = {
  schema_version: 1,
  kind: "success_count",
  attempts_per_set: 5,
  pass_threshold: 3,
};
const POINTS: DrillScoring = {
  schema_version: 1,
  kind: "points",
  attempts_per_set: 3,
  max_points_per_attempt: 3,
  pass_threshold: 6,
};
const STREAK: DrillScoring = { schema_version: 1, kind: "streak", streak_length: 3 };

function apply(state: RunnerState, ...actions: RunnerAction[]): RunnerState {
  return actions.reduce(runnerReducer, state);
}

function log(key: string, outcome: Outcome = "success", points: number | null = null): RunnerAction {
  return { type: "log", key, outcome, points, duration_ms: null, tapped_at: "2026-10-16T10:00:00Z" };
}

function serverAttempt(id: string, number: number, progress: SetProgress): AttemptRead {
  return {
    id,
    drill_run_id: "r1",
    attempt_number: number,
    outcome: "success",
    points: null,
    duration_ms: null,
    tapped_at: "2026-10-16T10:00:00Z",
    recorded_at: "2026-10-16T10:00:00Z",
    voided_at: null,
    notes: null,
    set_progress: progress,
  };
}

function summary(id: string, number: number, outcome: Outcome, voided = false): AttemptSummary {
  return {
    id,
    attempt_number: number,
    outcome,
    points: null,
    duration_ms: null,
    tapped_at: "2026-10-16T10:00:00Z",
    recorded_at: "2026-10-16T10:00:00Z",
    voided_at: voided ? "2026-10-16T10:01:00Z" : null,
    notes: null,
  };
}

const progressOf = (scoring: DrillScoring, outcomes: Outcome[]) =>
  computeSetProgress(
    scoring,
    outcomes.map((outcome) => ({ outcome, points: null, is_voided: false })),
  );

describe("runnerReducer", () => {
  it("adds a tap at once as an attempt being sent", () => {
    const state = apply(initialRunnerState, log("k1", "fail"));

    expect(state.attempts).toEqual([
      {
        key: "k1",
        id: null,
        outcome: "fail",
        points: null,
        duration_ms: null,
        tapped_at: "2026-10-16T10:00:00Z",
        status: "sending",
        is_voided: false,
        is_voiding: false,
      },
    ]);
  });

  it("drops an attempt the server refused", () => {
    const state = apply(initialRunnerState, log("k1"), log("k2"), { type: "discard", key: "k1" });

    expect(state.attempts.map((attempt) => attempt.key)).toEqual(["k2"]);
  });

  it("marks an attempt saved and keeps the server's progress", () => {
    const progress = progressOf(MAKE_3_OF_5, ["success"]);
    const state = apply(initialRunnerState, log("k1"), {
      type: "saved",
      key: "k1",
      attempt: serverAttempt("a1", 1, progress),
    });

    expect(state.attempts[0]).toMatchObject({ id: "a1", status: "saved" });
    expect(state.server_progress).toBe(progress);
  });

  it("fails and retries an attempt without changing its key", () => {
    const failed = apply(initialRunnerState, log("k1"), { type: "failed", key: "k1" });
    expect(failed.attempts[0]).toMatchObject({ key: "k1", status: "failed" });

    const retried = runnerReducer(failed, { type: "retry", key: "k1" });
    expect(retried.attempts[0]).toMatchObject({ key: "k1", status: "sending" });
  });

  it("loads the server's attempts as saved, with undone ones marked", () => {
    const state = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail", true)],
      progress: progressOf(MAKE_3_OF_5, ["success"]),
    });

    expect(state.attempts.map((a) => [a.id, a.status, a.is_voided])).toEqual([
      ["a1", "saved", false],
      ["a2", "saved", true],
    ]);
  });

  it("undoes at once, and restores the attempt if the undo fails", () => {
    const base = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success")],
      progress: progressOf(MAKE_3_OF_5, ["success"]),
    });

    const undone = runnerReducer(base, { type: "void", key: "a1" });
    expect(undone.attempts[0]).toMatchObject({ is_voided: true, is_voiding: true });

    const restored = runnerReducer(undone, { type: "void_failed", key: "a1" });
    expect(restored.attempts[0]).toMatchObject({ is_voided: false, is_voiding: false });
  });

  it("takes the server's progress when an undo is confirmed", () => {
    const empty = progressOf(MAKE_3_OF_5, []);
    const state = apply(
      initialRunnerState,
      { type: "load", attempts: [summary("a1", 1, "success")], progress: progressOf(MAKE_3_OF_5, ["success"]) },
      { type: "void", key: "a1" },
      { type: "voided", key: "a1", progress: empty },
    );

    expect(state.attempts[0]).toMatchObject({ is_voided: true, is_voiding: false });
    expect(state.server_progress).toBe(empty);
  });
});

describe("displayProgress", () => {
  it("uses the local count while a tap is unconfirmed", () => {
    const loaded = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success")],
      progress: progressOf(MAKE_3_OF_5, ["success"]),
    });
    const state = apply(loaded, log("k2", "success"));

    expect(displayProgress(state, MAKE_3_OF_5).successes).toBe(2);
    expect(displayProgress(state, MAKE_3_OF_5).attempts_in_set).toBe(2);
  });

  it("switches to the server's answer once everything is saved", () => {
    const serverSays = { ...progressOf(MAKE_3_OF_5, ["success", "success"]), successes: 99 };
    const state = apply(
      initialRunnerState,
      log("k1"),
      { type: "saved", key: "k1", attempt: serverAttempt("a1", 1, serverSays) },
    );

    expect(displayProgress(state, MAKE_3_OF_5)).toBe(serverSays);
  });

  it("counts a failed tap locally, since the server never heard of it", () => {
    const state = apply(initialRunnerState, log("k1"), { type: "failed", key: "k1" });

    expect(displayProgress(state, MAKE_3_OF_5).attempts_in_set).toBe(1);
  });

  it("ignores an undone attempt in the local count", () => {
    const state = apply(
      initialRunnerState,
      { type: "load", attempts: [summary("a1", 1, "success"), summary("a2", 2, "success")], progress: progressOf(MAKE_3_OF_5, ["success", "success"]) },
      { type: "void", key: "a2" },
    );

    expect(displayProgress(state, MAKE_3_OF_5).attempts_in_set).toBe(1);
  });
});

describe("undo and failures", () => {
  const loaded = apply(initialRunnerState, {
    type: "load",
    attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail", true), summary("a3", 3, "partial")],
    progress: progressOf(MAKE_3_OF_5, ["success", "partial"]),
  });

  it("undoes the newest attempt that is not already undone", () => {
    expect(undoTarget(loaded)?.id).toBe("a3");
    const afterUndo = apply(loaded, { type: "void", key: "a3" }, { type: "voided", key: "a3", progress: progressOf(MAKE_3_OF_5, ["success"]) });
    expect(undoTarget(afterUndo)?.id).toBe("a1");
  });

  it("cannot undo again while an undo is still being sent", () => {
    const voiding = apply(loaded, { type: "void", key: "a3" });

    expect(undoTarget(voiding)).toBeNull();
    const confirmed = apply(voiding, {
      type: "voided",
      key: "a3",
      progress: progressOf(MAKE_3_OF_5, ["success"]),
    });
    expect(undoTarget(confirmed)?.id).toBe("a1");
  });

  it("waits for a tap to be saved before it can be undone", () => {
    const sending = apply(loaded, log("k4"));
    expect(lastCounted(sending)?.key).toBe("k4");
    expect(undoTarget(sending)).toBeNull();
  });

  it("has nothing to undo with no attempts, or when all are undone", () => {
    expect(undoTarget(initialRunnerState)).toBeNull();
    const allUndone = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success", true)],
      progress: progressOf(MAKE_3_OF_5, []),
    });
    expect(undoTarget(allUndone)).toBeNull();
  });

  it("reports the first failed attempt", () => {
    expect(hasFailed(loaded)).toBeNull();
    const failed = apply(loaded, log("k4"), { type: "failed", key: "k4" });
    expect(hasFailed(failed)?.key).toBe("k4");
  });
});

describe("runTotals", () => {
  it("counts makes and attempts across sets, leaving out undone ones", () => {
    const state = apply(initialRunnerState, {
      type: "load",
      attempts: [
        summary("a1", 1, "success"),
        summary("a2", 2, "fail"),
        summary("a3", 3, "success", true),
        summary("a4", 4, "partial"),
        summary("a5", 5, "success"),
      ],
      progress: progressOf(MAKE_3_OF_5, []),
    });

    expect(runTotals(state)).toEqual({ made: 2, taken: 4 });
  });
});

describe("statusFor", () => {
  const status = (scoring: DrillScoring, outcomes: Outcome[]) =>
    statusFor(progressOf(scoring, outcomes), scoring);

  it("says how many makes a set still needs", () => {
    expect(status(MAKE_3_OF_5, [])).toEqual({ text: "3 more makes to pass", tone: "neutral" });
    expect(status(MAKE_3_OF_5, ["success", "success"])).toEqual({
      text: "1 more make to pass",
      tone: "neutral",
    });
  });

  it("says when the set is already passed, or can no longer be", () => {
    expect(status(MAKE_3_OF_5, ["success", "success", "success"])).toEqual({
      text: "Set passed",
      tone: "good",
    });
    expect(status(MAKE_3_OF_5, ["fail", "fail", "fail"])).toEqual({
      text: "Can’t pass this set",
      tone: "bad",
    });
  });

  it("reports a finished set with its score", () => {
    expect(status(MAKE_3_OF_5, ["success", "fail", "success", "success", "fail"])).toEqual({
      text: "Set passed · 3 of 5",
      tone: "good",
    });
    expect(status(MAKE_3_OF_5, ["success", "fail", "fail", "success", "fail"])).toEqual({
      text: "Set missed · 2 of 5",
      tone: "bad",
    });
  });

  it("counts points for a points drill", () => {
    const progress = computeSetProgress(POINTS, [
      { outcome: "partial", points: 2, is_voided: false },
    ]);
    expect(statusFor(progress, POINTS)).toEqual({ text: "4 more points to pass", tone: "neutral" });

    const done = computeSetProgress(POINTS, [
      { outcome: "success", points: 3, is_voided: false },
      { outcome: "fail", points: 0, is_voided: false },
      { outcome: "partial", points: 1, is_voided: false },
    ]);
    expect(statusFor(done, POINTS)).toEqual({ text: "Set missed · 4 of 9", tone: "bad" });
  });

  it("counts the streak for a streak drill", () => {
    expect(status(STREAK, ["success"])).toEqual({
      text: "2 more in a row to reach 3",
      tone: "neutral",
    });
    expect(status(STREAK, ["success", "success", "success"])).toEqual({
      text: "Streak reached · best 3",
      tone: "good",
    });
  });
});

describe("marksFor", () => {
  it("fills the current set's slots and marks unsent ones as pending", () => {
    const loaded = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail"), summary("a3", 3, "partial")],
      progress: progressOf(MAKE_3_OF_5, ["success", "fail", "partial"]),
    });
    const state = apply(loaded, log("k4", "success"));

    const marks = marksFor(state, displayProgress(state, MAKE_3_OF_5), MAKE_3_OF_5);

    expect(marks).toEqual(["success", "fail", "partial", "pending", "empty"]);
  });

  it("shows only the current set once an earlier one is finished", () => {
    const outcomes: Outcome[] = ["success", "fail", "success", "success", "fail", "success"];
    const state = apply(initialRunnerState, {
      type: "load",
      attempts: outcomes.map((outcome, index) => summary(`a${index}`, index + 1, outcome)),
      progress: progressOf(MAKE_3_OF_5, outcomes),
    });

    expect(marksFor(state, displayProgress(state, MAKE_3_OF_5), MAKE_3_OF_5)).toEqual([
      "success",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("shows the streak so far for a streak drill", () => {
    const state = apply(initialRunnerState, {
      type: "load",
      attempts: [summary("a1", 1, "success"), summary("a2", 2, "success")],
      progress: progressOf(STREAK, ["success", "success"]),
    });

    expect(marksFor(state, displayProgress(state, STREAK), STREAK)).toEqual([
      "success",
      "success",
      "empty",
    ]);
  });
});

describe("lastLoggedText", () => {
  it("says what the newest counted attempt was", () => {
    expect(lastLoggedText(initialRunnerState, MAKE_3_OF_5)).toBe("No attempts yet");
    const state = apply(initialRunnerState, log("k1", "success"), log("k2", "partial"));
    expect(lastLoggedText(state, MAKE_3_OF_5)).toBe("Attempt 2 · Partial");
  });

  it("counts attempts without the undone ones", () => {
    const state = apply(
      initialRunnerState,
      { type: "load", attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail", true)], progress: progressOf(MAKE_3_OF_5, []) },
    );
    expect(lastLoggedText(state, MAKE_3_OF_5)).toBe("Attempt 1 · Make");
  });

  it("gives the points for a points drill", () => {
    const state = apply(initialRunnerState, log("k1", "partial", 2));
    expect(lastLoggedText(state, POINTS)).toBe("Attempt 1 · 2 points");
  });
});
