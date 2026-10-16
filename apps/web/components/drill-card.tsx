import type { DrillRead, DrillScoring } from "@/lib/api-client";
import { DifficultyPips } from "./difficulty-pips";
import { TableThumbnail } from "./table-thumbnail";

export function scoringLabel(scoring: DrillScoring): string {
  switch (scoring.kind) {
    case "success_count":
      return `Make ${scoring.pass_threshold} of ${scoring.attempts_per_set}`;
    case "streak":
      return `${scoring.streak_length} in a row`;
    case "points":
      return `${scoring.pass_threshold} points per set`;
    case "timed": {
      const minutes = Math.round(scoring.time_limit_seconds / 60);
      return `${scoring.pass_threshold} of ${scoring.attempts_per_set} in ${minutes} min`;
    }
  }
}

export function DrillCard({ drill }: { drill: DrillRead }) {
  const version = drill.current_version;
  return (
    <li>
      <article
        className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-muted"
        data-testid="drill-card"
        data-drill-id={drill.id}
      >
        <div className="overflow-hidden rounded-lg">
          {version ? (
            <TableThumbnail layout={version.layout} label={`Table layout for ${drill.title}`} />
          ) : (
            <div className="aspect-[8.9/4.9] bg-raised" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-[22px] font-semibold leading-[1.1]">{drill.title}</h2>
            {drill.status !== "active" && (
              <span
                className="flex-none rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted"
                data-testid="drill-status"
              >
                {drill.status === "draft" ? "Draft" : "Archived"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DifficultyPips difficulty={drill.difficulty} />
            {version && <span className="text-sm text-muted">{scoringLabel(version.scoring)}</span>}
          </div>
          {drill.tags.length > 0 && (
            <ul className="mt-0.5 flex flex-wrap gap-1.5">
              {drill.tags.map((tag) => (
                <li
                  key={tag.id}
                  className="inline-flex h-[26px] items-center rounded-full border border-line px-2.5 text-xs text-muted"
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex justify-end pt-2 font-mono text-[13px] text-muted">
            {version && <span>v{version.version_number}</span>}
          </div>
        </div>
      </article>
    </li>
  );
}
