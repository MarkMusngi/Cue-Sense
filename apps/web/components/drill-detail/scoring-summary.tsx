import type { DrillScoring } from "@/lib/api-client";
import { scoringDetail, scoringLabel } from "@/lib/scoring-text";

export function ScoringSummary({ scoring }: { scoring: DrillScoring }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-testid="drill-detail-scoring">
      <span className="font-display text-2xl font-semibold">{scoringLabel(scoring)}</span>
      <span className="text-sm text-muted">{scoringDetail(scoring)}</span>
    </div>
  );
}
