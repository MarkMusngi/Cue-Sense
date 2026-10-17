"use client";

import { useState } from "react";

import type { DrillScoring, Outcome } from "@/lib/api-client";
import { parseSeconds } from "@/lib/format-elapsed";

import { Button } from "../ui/button";
import { OutcomeButton } from "../ui/outcome-button";
import { TextField } from "../ui/text-field";

/** What a tap logs: an outcome, or points, with a time for timed drills. */
export type AttemptTap = { outcome: Outcome; points: number | null; duration_ms: number | null };

type AttemptControlsProps = {
  scoring: DrillScoring;
  disabled: boolean;
  onLog: (tap: AttemptTap) => void;
};

/** Up to this many points get a button each; above it a number field is easier to use. */
const MAX_POINT_BUTTONS = 10;

function outcomeForPoints(points: number, max: number): Outcome {
  if (points === 0) return "fail";
  return points === max ? "success" : "partial";
}

/** Make, Miss and Partial; or the points to score; with the time for a timed drill. */
export function AttemptControls({ scoring, disabled, onLog }: AttemptControlsProps) {
  const [seconds, setSeconds] = useState("");
  const [typedPoints, setTypedPoints] = useState("");

  if (scoring.kind === "points") {
    const max = scoring.max_points_per_attempt;
    const log = (points: number) => onLog({ outcome: outcomeForPoints(points, max), points, duration_ms: null });
    if (max > MAX_POINT_BUTTONS) {
      const parsed = /^\d+$/.test(typedPoints.trim()) ? Number(typedPoints) : null;
      const valid = parsed !== null && parsed <= max;
      return (
        <div className="flex items-end gap-2" data-testid="runner-points-field">
          <TextField
            label={`Points (0 to ${max})`}
            inputMode="numeric"
            value={typedPoints}
            className="flex-1"
            data-testid="runner-points"
            onChange={(event) => setTypedPoints(event.target.value)}
          />
          <Button
            variant="primary"
            disabled={disabled || !valid}
            data-testid="runner-points-log"
            onClick={() => {
              if (parsed !== null) log(parsed);
              setTypedPoints("");
            }}
          >
            Log
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted">Points for this attempt: 0 misses, {max} is a make.</p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(max + 1, 4)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: max + 1 }, (_, points) => (
            <Button
              key={points}
              variant={points === max ? "primary" : "secondary"}
              disabled={disabled}
              className="min-h-16 font-display text-3xl font-bold"
              data-testid={`runner-points-${points}`}
              onClick={() => log(points)}
            >
              {points}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const duration = scoring.kind === "timed" ? parseSeconds(seconds) : null;
  const needsTime = scoring.kind === "timed";
  const blocked = disabled || (needsTime && duration === null);
  const tap = (outcome: Outcome) => {
    onLog({ outcome, points: null, duration_ms: duration });
    if (needsTime) setSeconds("");
  };

  return (
    <div className="flex flex-col gap-2">
      {needsTime && (
        <TextField
          label="Time for this attempt (seconds)"
          inputMode="decimal"
          autoComplete="off"
          value={seconds}
          hint={duration === null ? "Enter the time before logging." : undefined}
          data-testid="runner-seconds"
          onChange={(event) => setSeconds(event.target.value)}
        />
      )}
      <OutcomeButton
        outcome="partial"
        size="medium"
        disabled={blocked}
        data-testid="runner-outcome-partial"
        onClick={() => tap("partial")}
      />
      <div className="grid grid-cols-2 gap-2">
        <OutcomeButton
          outcome="fail"
          disabled={blocked}
          data-testid="runner-outcome-fail"
          onClick={() => tap("fail")}
        />
        <OutcomeButton
          outcome="success"
          disabled={blocked}
          data-testid="runner-outcome-success"
          onClick={() => tap("success")}
        />
      </div>
    </div>
  );
}
