// The session runner's attempt list and what it shows, as pure logic (no React).
//
// A tap adds an attempt at once, marked "sending". The tally comes from the local set
// progress while anything is unconfirmed, and from the server's answer once everything is
// saved, so the screen never drifts from the server for long.

import type {
  AttemptRead,
  AttemptSummary,
  DrillScoring,
  Outcome,
  SetProgress,
} from "@/lib/api-client";
import type { RailMark } from "@/lib/rail-sights";
import { computeSetProgress } from "@/lib/set-progress";

export type AttemptStatus = "sending" | "saved" | "failed";

export type LocalAttempt = {
  /** The Idempotency-Key of the tap (the attempt id for one loaded from the server). */
  key: string;
  /** The server's id, once the attempt is saved. */
  id: string | null;
  outcome: Outcome;
  points: number | null;
  duration_ms: number | null;
  status: AttemptStatus;
  is_voided: boolean;
  /** An undo that has been sent and not yet confirmed. */
  is_voiding: boolean;
};

export type RunnerState = {
  attempts: LocalAttempt[];
  /** The set progress from the newest server response. */
  server_progress: SetProgress | null;
};

export type RunnerAction =
  | { type: "load"; attempts: AttemptSummary[]; progress: SetProgress }
  | { type: "log"; key: string; outcome: Outcome; points: number | null; duration_ms: number | null }
  | { type: "saved"; key: string; attempt: AttemptRead }
  | { type: "failed"; key: string }
  | { type: "retry"; key: string }
  | { type: "void"; key: string }
  | { type: "voided"; key: string; progress: SetProgress }
  | { type: "void_failed"; key: string };

export const initialRunnerState: RunnerState = { attempts: [], server_progress: null };

function fromServer(attempt: AttemptSummary): LocalAttempt {
  return {
    key: attempt.id,
    id: attempt.id,
    outcome: attempt.outcome,
    points: attempt.points,
    duration_ms: attempt.duration_ms,
    status: "saved",
    is_voided: attempt.voided_at !== null,
    is_voiding: false,
  };
}

function change(state: RunnerState, key: string, patch: Partial<LocalAttempt>): RunnerState {
  return {
    ...state,
    attempts: state.attempts.map((attempt) => (attempt.key === key ? { ...attempt, ...patch } : attempt)),
  };
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case "load":
      return { attempts: action.attempts.map(fromServer), server_progress: action.progress };
    case "log":
      return {
        ...state,
        attempts: [
          ...state.attempts,
          {
            key: action.key,
            id: null,
            outcome: action.outcome,
            points: action.points,
            duration_ms: action.duration_ms,
            status: "sending",
            is_voided: false,
            is_voiding: false,
          },
        ],
      };
    case "saved":
      return {
        ...change(state, action.key, { id: action.attempt.id, status: "saved" }),
        server_progress: action.attempt.set_progress,
      };
    case "failed":
      return change(state, action.key, { status: "failed" });
    case "retry":
      return change(state, action.key, { status: "sending" });
    case "void":
      return change(state, action.key, { is_voided: true, is_voiding: true });
    case "voided":
      return {
        ...change(state, action.key, { is_voiding: false }),
        server_progress: action.progress,
      };
    case "void_failed":
      return change(state, action.key, { is_voided: false, is_voiding: false });
  }
}

function toScored(attempts: LocalAttempt[]) {
  return attempts.map((attempt) => ({
    outcome: attempt.outcome,
    points: attempt.points,
    is_voided: attempt.is_voided,
  }));
}

/** Whether the server's progress covers everything on screen. */
function isConfirmed(state: RunnerState): boolean {
  return (
    state.server_progress !== null &&
    state.attempts.every((attempt) => attempt.status === "saved" && !attempt.is_voiding)
  );
}

/** The progress to show: the server's once everything is saved, otherwise worked out here. */
export function displayProgress(state: RunnerState, scoring: DrillScoring): SetProgress {
  if (isConfirmed(state) && state.server_progress) return state.server_progress;
  return computeSetProgress(scoring, toScored(state.attempts));
}

/** A failed send blocks new taps, so attempts reach the server in order. */
export function hasFailed(state: RunnerState): LocalAttempt | null {
  return state.attempts.find((attempt) => attempt.status === "failed") ?? null;
}

/** The newest attempt that is not undone. Null when there is none. */
export function lastCounted(state: RunnerState): LocalAttempt | null {
  for (let index = state.attempts.length - 1; index >= 0; index--) {
    if (!state.attempts[index].is_voided) return state.attempts[index];
  }
  return null;
}

/** The attempt Undo would void: the newest counted one, once it has been saved. */
export function undoTarget(state: RunnerState): LocalAttempt | null {
  const last = lastCounted(state);
  return last && last.status === "saved" && last.id !== null && !last.is_voiding ? last : null;
}

export function runTotals(state: RunnerState): { made: number; taken: number } {
  const counted = state.attempts.filter((attempt) => !attempt.is_voided);
  return { made: counted.filter((a) => a.outcome === "success").length, taken: counted.length };
}

export type StatusTone = "good" | "bad" | "neutral";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The line under the score: what the set needs, or how it ended. */
export function statusFor(progress: SetProgress, scoring: DrillScoring): { text: string; tone: StatusTone } {
  if (scoring.kind === "streak") {
    const current = progress.current_streak ?? 0;
    if (progress.set_complete) {
      return { text: `Streak reached · best ${progress.best_streak ?? current}`, tone: "good" };
    }
    return {
      text: `${scoring.streak_length - current} more in a row to reach ${scoring.streak_length}`,
      tone: "neutral",
    };
  }

  const isPoints = scoring.kind === "points";
  const score = isPoints ? (progress.points ?? 0) : progress.successes;
  const most = isPoints ? scoring.attempts_per_set * scoring.max_points_per_attempt : scoring.attempts_per_set;
  const unit = isPoints ? "of " + most : "of " + scoring.attempts_per_set;

  if (progress.set_complete) {
    const passed = progress.set_passed === true;
    return {
      text: `${passed ? "Set passed" : "Set missed"} · ${score} ${unit}`,
      tone: passed ? "good" : "bad",
    };
  }
  const need = scoring.pass_threshold - score;
  const remaining = scoring.attempts_per_set - progress.attempts_in_set;
  const mostRemaining = isPoints ? remaining * scoring.max_points_per_attempt : remaining;
  if (need <= 0) return { text: "Set passed", tone: "good" };
  if (need > mostRemaining) return { text: "Can’t pass this set", tone: "bad" };
  return {
    text: isPoints
      ? `${plural(need, "more point", "more points")} to pass`
      : `${plural(need, "more make", "more makes")} to pass`,
    tone: "neutral",
  };
}

/** One mark per attempt slot in the current set (or in the streak to reach). */
export function marksFor(state: RunnerState, progress: SetProgress, scoring: DrillScoring): RailMark[] {
  const counted = state.attempts.filter((attempt) => !attempt.is_voided);
  const mark = (attempt: LocalAttempt): RailMark =>
    attempt.status === "sending" ? "pending" : attempt.outcome;

  if (scoring.kind === "streak") {
    const current = progress.current_streak ?? 0;
    return Array.from({ length: scoring.streak_length }, (_, index) =>
      index < current ? "success" : "empty",
    );
  }
  const perSet = scoring.attempts_per_set;
  const inSet = counted.slice((progress.set_number - 1) * perSet);
  return Array.from({ length: perSet }, (_, index) => (inSet[index] ? mark(inSet[index]) : "empty"));
}

const NAMES: Record<Outcome, string> = { success: "Make", fail: "Miss", partial: "Partial" };

/** "Attempt 14 · Make", or "3 points" for a points drill; for the live region under the score. */
export function lastLoggedText(state: RunnerState, scoring: DrillScoring): string {
  const counted = state.attempts.filter((attempt) => !attempt.is_voided);
  const last = counted[counted.length - 1];
  if (!last) return "No attempts yet";
  const what =
    scoring.kind === "points" ? plural(last.points ?? 0, "point", "points") : NAMES[last.outcome];
  return `Attempt ${counted.length} · ${what}`;
}
