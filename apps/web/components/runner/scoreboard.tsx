import type { DrillScoring, SetProgress } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import type { RailMark } from "@/lib/rail-sights";
import type { StatusTone } from "@/lib/runner-state";

import { Button } from "../ui/button";
import { RailSights } from "../ui/rail-sights";

const TONES: Record<StatusTone, string> = {
  good: "text-chalk",
  bad: "text-miss",
  neutral: "text-muted",
};

type ScoreboardProps = {
  scoring: DrillScoring;
  progress: SetProgress;
  marks: RailMark[];
  status: { text: string; tone: StatusTone };
  totals: { made: number; taken: number };
  lastLogged: string;
  canUndo: boolean;
  onUndo: () => void;
};

/** The big score for the current set, what it needs, the set's sights and Undo. */
export function Scoreboard({
  scoring,
  progress,
  marks,
  status,
  totals,
  lastLogged,
  canUndo,
  onUndo,
}: ScoreboardProps) {
  const isStreak = scoring.kind === "streak";
  const isPoints = scoring.kind === "points";
  // Streak: the streak so far over the one to reach. Points: points over the most a set holds.
  // Otherwise makes over attempts taken so far, as on the table.
  const score = isStreak ? (progress.current_streak ?? 0) : isPoints ? (progress.points ?? 0) : progress.successes;
  const outOf = isStreak
    ? scoring.streak_length
    : isPoints
      ? scoring.attempts_per_set * scoring.max_points_per_attempt
      : progress.attempts_in_set;

  return (
    <section aria-label="Scoreboard" className="flex flex-col gap-3" data-testid="runner-scoreboard">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div
            className="font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-muted"
            data-testid="runner-set"
          >
            {isStreak ? "Streak" : `Set ${progress.set_number}`}
          </div>
          <div className="font-display text-[84px] font-bold leading-[0.85] tabular-nums">
            <span data-testid="runner-made">{score}</span>
            <span className="text-[44px] font-semibold text-muted" data-testid="runner-taken">
              /{outOf}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 pb-1.5 text-right">
          <div
            className={cx("text-[15px] font-semibold", TONES[status.tone])}
            data-testid="runner-status"
          >
            {status.text}
          </div>
          <div className="text-[13px] text-muted" data-testid="runner-run-total">
            Run total {totals.made} of {totals.taken}
          </div>
        </div>
      </div>

      <div data-testid="runner-pips">
        <RailSights marks={marks} size={26} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-muted">
        <span aria-live="polite" data-testid="runner-last">
          {lastLogged}
        </span>
        <Button variant="ghost" disabled={!canUndo} data-testid="runner-undo" onClick={onUndo}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5 3 L2 6 L5 9 M2 6 H10 A4 4 0 0 1 10 14 H7"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Undo
        </Button>
      </div>
    </section>
  );
}
