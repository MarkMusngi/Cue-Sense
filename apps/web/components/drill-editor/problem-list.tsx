"use client";

import type { Problem } from "@/lib/drill-problems";

import { Button } from "../ui/button";

type ProblemListProps = {
  problems: Problem[];
  onSelectBall: (ballId: string) => void;
  onGoToField: (key: string) => void;
};

/** Keys that have a field to go to. */
function hasField(key: string): boolean {
  return key !== "layout" && key !== "form" && !key.startsWith("ball:");
}

/** Everything that stops a save, with a way to get to each one. */
export function ProblemList({ problems, onSelectBall, onGoToField }: ProblemListProps) {
  if (problems.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="drill-editor-problems"
      className="flex flex-col gap-2 rounded-xl border border-miss bg-miss-soft p-3.5"
    >
      <p className="font-semibold text-miss">
        {problems.length} {problems.length === 1 ? "problem" : "problems"} to fix before saving
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {problems.map((problem, index) => (
          <li
            key={`${problem.key}-${index}`}
            data-testid={`drill-editor-problem-${index}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <span>{problem.message}</span>
            {problem.code && (
              <span className="font-mono text-xs text-muted">
                {problem.path} · {problem.code}
              </span>
            )}
            {problem.ball_id ? (
              <Button
                variant="secondary"
                className="min-h-11 border-miss px-3 text-[13px] font-semibold text-miss"
                data-testid={`drill-editor-problem-action-${index}`}
                onClick={() => onSelectBall(problem.ball_id as string)}
              >
                Select the ball
              </Button>
            ) : (
              hasField(problem.key) && (
                <Button
                  variant="secondary"
                  className="min-h-11 border-miss px-3 text-[13px] font-semibold text-miss"
                  data-testid={`drill-editor-problem-action-${index}`}
                  onClick={() => onGoToField(problem.key)}
                >
                  Go to field
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
