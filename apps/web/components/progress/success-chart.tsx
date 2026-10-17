import type { SuccessRateStats } from "@/lib/api-client";
import { buildSuccessChart, CHART, FEW_ATTEMPTS, percent, shortDate } from "@/lib/stats";

/** Success rate over time for one drill: a line through the buckets that have attempts,
 *  a marker where a new version of the drill began, and faded points for buckets with
 *  few attempts. */
export function SuccessChart({ stats, title }: { stats: SuccessRateStats; title: string }) {
  const chart = buildSuccessChart(stats);
  const { width, height, left, top, bottom } = CHART;
  const first = chart.points[0];
  const last = chart.points[chart.points.length - 1];
  const label =
    chart.points.length === 0
      ? `No attempts for ${title} between ${shortDate(chart.from)} and ${shortDate(chart.to)}`
      : `Success rate for ${title}: ${percent(first.success_rate)} on ${shortDate(first.bucket_start)}` +
        (chart.points.length > 1
          ? ` to ${percent(last.success_rate)} on ${shortDate(last.bucket_start)}, over ${chart.points.length} ${stats.bucket === "day" ? "days" : "weeks"} with attempts`
          : "");

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        data-testid="success-chart"
        className="block h-auto w-full"
      >
        {chart.grid.map((line) => (
          <g key={line.value}>
            <line x1={left} y1={line.y} x2={width - 16} y2={line.y} stroke="var(--line)" />
            <text x={left - 8} y={line.y + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {Math.round(line.value * 100)}%
            </text>
          </g>
        ))}
        {chart.boundaries.map((b) => (
          <g key={b.version_number} data-testid={`version-boundary-${b.version_number}`}>
            <line
              x1={b.x}
              y1={top - 8}
              x2={b.x}
              y2={height - bottom}
              stroke="var(--muted)"
              strokeWidth="1.5"
              strokeDasharray={b.scoring_changed ? "2 3" : undefined}
            />
            <text x={b.x + 5} y={top + 4} fontSize="12" fontWeight="600" fill="var(--text)">
              {`v${b.version_number}${b.scoring_changed ? " · scoring changed" : ""}`}
            </text>
          </g>
        ))}
        {chart.points.length > 1 && (
          <polyline
            points={chart.line}
            fill="none"
            stroke="var(--chalk)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        )}
        {chart.points.map((p) => (
          <circle
            key={p.bucket_start}
            cx={p.x}
            cy={p.y}
            r="5"
            fill={p.few ? "var(--chalk)" : "var(--bg)"}
            fillOpacity={p.few ? 0.35 : 1}
            stroke="var(--chalk)"
            strokeWidth="2.5"
            strokeOpacity={p.few ? 0.5 : 1}
            data-testid="success-chart-point"
            data-few={p.few ? "true" : undefined}
          />
        ))}
        <text x={left} y={height - 10} fontSize="11" fill="var(--muted)">
          {shortDate(chart.from)}
        </text>
        <text x={width - 16} y={height - 10} textAnchor="end" fontSize="11" fill="var(--muted)">
          {shortDate(chart.to)}
        </text>
      </svg>

      <table className="sr-only" data-testid="success-chart-table">
        <caption>Success rate by {stats.bucket === "day" ? "day" : "week"}</caption>
        <thead>
          <tr>
            <th scope="col">{stats.bucket === "day" ? "Day" : "Week starting"}</th>
            <th scope="col">Attempts</th>
            <th scope="col">Success rate</th>
          </tr>
        </thead>
        <tbody>
          {chart.points.map((p) => (
            <tr key={p.bucket_start}>
              <td>{shortDate(p.bucket_start)}</td>
              <td>{p.attempts}</td>
              <td>{percent(p.success_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {chart.has_few && (
        <p className="text-xs text-muted" data-testid="few-attempts-note">
          Faded points have fewer than {FEW_ATTEMPTS} attempts, so treat them as a rough guide.
        </p>
      )}
      {chart.scoring_changed_versions.length > 0 && (
        <p className="text-xs text-muted" data-testid="scoring-changed-note">
          {`The scoring changed at ${chart.scoring_changed_versions.map((n) => `v${n}`).join(", ")}: rates before and after are not comparable.`}
        </p>
      )}
    </div>
  );
}
