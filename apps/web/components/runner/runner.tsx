"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState, useTransition } from "react";

import {
  endRunAction,
  logAttemptAction,
  voidAttemptAction,
} from "@/app/(app)/sessions/actions";
import type {
  AttemptInput,
  AttemptSummary,
  DrillRunRead,
  DrillVersionRead,
} from "@/lib/api-client";
import { formatElapsed } from "@/lib/format-elapsed";
import {
  displayProgress,
  hasFailed,
  initialRunnerState,
  lastLoggedText,
  marksFor,
  runnerReducer,
  runTotals,
  statusFor,
  undoTarget,
  type LocalAttempt,
} from "@/lib/runner-state";
import { scoringLabel } from "@/lib/scoring-text";
import { newKey } from "@/lib/uuid";

import { TableEditor } from "../table-editor/table-editor";
import { Button } from "../ui/button";
import { AttemptControls, type AttemptTap } from "./attempt-controls";
import { Scoreboard } from "./scoreboard";

type RunnerProps = {
  sessionId: string;
  sessionStartedAt: string;
  sessionEndedAt: string | null;
  run: DrillRunRead;
  drillTitle: string;
  /** The version the run started with, not the drill's current one. */
  version: DrillVersionRead;
  initialAttempts: AttemptSummary[];
};

/** Elapsed time since a start, ticking each second until an end time is known. */
function useElapsed(startedAt: string, endedAt: string | null): string {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (endedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endedAt]);
  const end = endedAt ? Date.parse(endedAt) : now;
  // Before the first tick on the client there is no time yet, and the server has none.
  return end === null ? "…" : formatElapsed(end - Date.parse(startedAt));
}

/** The attempt as the API wants it: points for a points drill, otherwise an outcome. */
function inputFor(attempt: LocalAttempt, isPoints: boolean): AttemptInput {
  const when = attempt.tapped_at ? { tapped_at: attempt.tapped_at } : {};
  if (isPoints) return { ...when, points: attempt.points ?? 0 };
  return {
    ...when,
    outcome: attempt.outcome,
    ...(attempt.duration_ms !== null ? { duration_ms: attempt.duration_ms } : {}),
  };
}

/**
 * Logs attempts against a drill run: big buttons, a tally that updates at once and is then
 * replaced by the server's own, undo, and ending the run. Needs a connection.
 */
export function Runner({
  sessionId,
  sessionStartedAt,
  sessionEndedAt,
  run,
  drillTitle,
  version,
  initialAttempts,
}: RunnerProps) {
  const router = useRouter();
  const scoring = version.scoring;
  const isPoints = scoring.kind === "points";
  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    runnerReducer(initialRunnerState, {
      type: "load",
      attempts: initialAttempts,
      progress: run.set_progress,
    }),
  );
  const [isEnded, setIsEnded] = useState(run.ended_at !== null || sessionEndedAt !== null);
  const [message, setMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isEnding, startEnding] = useTransition();
  const elapsed = useElapsed(sessionStartedAt, sessionEndedAt);

  // Specs wait for this: the server's HTML is visible before the buttons work.
  useEffect(() => setIsHydrated(true), []);

  const progress = displayProgress(state, scoring);
  const failed = hasFailed(state);
  const target = undoTarget(state);
  const isSending = state.attempts.some((attempt) => attempt.status === "sending" || attempt.is_voiding);
  const blocked = isEnded || failed !== null;

  async function submit(attempt: LocalAttempt) {
    const result = await logAttemptAction(run.id, attempt.key, inputFor(attempt, isPoints));
    if (result.ok) {
      dispatch({ type: "saved", key: attempt.key, attempt: result.data });
    } else if (result.code === "session_ended" || result.code === "drill_run_ended") {
      // Refused, so it was never recorded: take it back off the screen.
      dispatch({ type: "discard", key: attempt.key });
      setIsEnded(true);
      setMessage("This drill run has ended, so that attempt was not recorded.");
    } else {
      dispatch({ type: "failed", key: attempt.key });
    }
  }

  function log(tap: AttemptTap) {
    if (blocked) return;
    const key = newKey();
    const tapped_at = new Date().toISOString();
    setMessage(null);
    dispatch({ type: "log", key, ...tap, tapped_at });
    void submit({
      key,
      id: null,
      ...tap,
      tapped_at,
      status: "sending",
      is_voided: false,
      is_voiding: false,
    });
  }

  function retry() {
    if (!failed) return;
    dispatch({ type: "retry", key: failed.key });
    // The same key: if the first request did reach the server, it answers with that attempt.
    void submit({ ...failed, status: "sending" });
  }

  async function undo() {
    if (!target || target.id === null || isEnded) return;
    setMessage(null);
    dispatch({ type: "void", key: target.key });
    const result = await voidAttemptAction(target.id);
    if (result.ok) {
      dispatch({ type: "voided", key: target.key, progress: result.data.set_progress });
    } else {
      dispatch({ type: "void_failed", key: target.key });
      setMessage("Couldn’t undo that attempt. Try again.");
    }
  }

  function endRun() {
    setMessage(null);
    startEnding(async () => {
      const result = await endRunAction(run.id, sessionId);
      if (result.ok) {
        setIsEnded(true);
        router.push(`/sessions/${sessionId}`);
      } else {
        setMessage(result.error);
      }
    });
  }

  const attemptNumber = state.attempts.findIndex((attempt) => attempt.key === failed?.key) + 1;

  return (
    <div
      className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-6"
      data-testid="runner"
      data-hydrated={isHydrated}
    >
      <header className="flex items-center gap-2">
        <Link
          href={`/sessions/${sessionId}`}
          aria-label="Back to the session"
          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-text hover:bg-raised"
          data-testid="runner-back"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path
              d="M14 4 L7 11 L14 18"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className="truncate font-display text-[22px] font-semibold leading-[1.05]"
            data-testid="runner-title"
          >
            {drillTitle}
          </h1>
          <p className="text-xs text-muted">
            <span className="font-mono" data-testid="runner-version">
              v{version.version_number}
            </span>{" "}
            · {scoringLabel(scoring)} · session{" "}
            <span className="tabular-nums" data-testid="runner-session-time">
              {elapsed}
            </span>
          </p>
        </div>
        {!isEnded && (
          <Button
            disabled={isEnding || isSending || failed !== null}
            data-testid="runner-end"
            onClick={endRun}
          >
            End run
          </Button>
        )}
      </header>

      <div className="overflow-hidden rounded-xl">
        <TableEditor layout={version.layout} readOnly />
      </div>

      {isEnded && (
        <p
          className="rounded-xl border border-line bg-surface p-3 text-sm"
          data-testid="runner-ended"
        >
          This drill run has ended.{" "}
          <Link href={`/sessions/${sessionId}`} className="font-semibold text-chalk">
            Back to the session
          </Link>
        </p>
      )}

      <Scoreboard
        scoring={scoring}
        progress={progress}
        marks={marksFor(state, progress, scoring)}
        status={statusFor(progress, scoring)}
        totals={runTotals(state)}
        lastLogged={lastLoggedText(state, scoring)}
        canUndo={target !== null && !isEnded}
        onUndo={() => void undo()}
      />

      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-miss bg-miss-soft p-3 text-sm"
          data-testid="runner-error"
        >
          <span>Couldn’t save attempt {attemptNumber}. Check your connection.</span>
          <Button variant="secondary" data-testid="runner-retry" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-miss" data-testid="runner-message">
          {message}
        </p>
      )}

      <AttemptControls scoring={scoring} disabled={blocked} onLog={log} />
    </div>
  );
}
