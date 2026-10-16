import type { DrillScoring } from "@/lib/api-client";

import { scoringLabel } from "../drill-card";

/** The line under the headline rule, e.g. "per set of 10 attempts". */
export function scoringDetail(scoring: DrillScoring): string {
  switch (scoring.kind) {
    case "success_count":
      return `per set of ${scoring.attempts_per_set} attempts`;
    case "streak":
      return "the whole drill run is one set";
    case "points":
      return `per set of ${scoring.attempts_per_set} attempts, up to ${scoring.max_points_per_attempt} points each`;
    case "timed":
      return `within ${scoring.time_limit_seconds} seconds, per set of ${scoring.attempts_per_set} attempts`;
  }
}

export function ScoringSummary({ scoring }: { scoring: DrillScoring }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-testid="drill-detail-scoring">
      <span className="font-display text-2xl font-semibold">{scoringLabel(scoring)}</span>
      <span className="text-sm text-muted">{scoringDetail(scoring)}</span>
    </div>
  );
}
