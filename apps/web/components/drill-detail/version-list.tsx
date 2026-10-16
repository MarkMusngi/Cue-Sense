import type { DrillVersionRead } from "@/lib/api-client";
import { cx } from "@/lib/cx";

/** 12 Oct, with the year when it is not this year. */
export function formatVersionDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

type VersionListProps = {
  versions: DrillVersionRead[];
  currentVersionId: string | null;
};

/** Newest first. Each drill run keeps the version it started with. */
export function VersionList({ versions, currentVersionId }: VersionListProps) {
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  return (
    <div className="flex flex-col gap-2">
      <ol
        className="overflow-hidden rounded-xl border border-line"
        data-testid="drill-detail-versions"
      >
        {sorted.map((version, index) => {
          const isCurrent = version.id === currentVersionId;
          return (
            <li
              key={version.id}
              data-testid={`drill-detail-version-${version.version_number}`}
              className={cx(
                "flex items-center gap-3 px-3.5 py-3 text-sm",
                index > 0 && "border-t border-line",
                isCurrent && "bg-surface",
              )}
            >
              <span
                className={cx(
                  "font-mono text-[13px]",
                  isCurrent ? "font-medium text-chalk" : "text-muted",
                )}
              >
                v{version.version_number}
              </span>
              <span className={cx("flex-1", !isCurrent && "text-muted")}>
                {version.version_number === 1 ? "Created" : "Saved with changes"}
              </span>
              <span className="text-[13px] text-muted">
                {formatVersionDate(version.created_at)}
                {isCurrent ? " · current" : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-muted">Each drill run keeps the version it started with.</p>
    </div>
  );
}
