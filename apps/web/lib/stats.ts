// Pure helpers for the progress screen: the range choice, and the geometry of its charts.
// The numbers themselves come from the API (docs/stats-contract.md); nothing here sums attempts.

import type { SuccessRateStats } from "@/lib/api-client";

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
export const DEFAULT_RANGE: RangeDays = 30;

/** Points with fewer attempts than this are drawn faded: one or two shots say little. */
export const FEW_ATTEMPTS = 5;

export type ProgressParams = { range: RangeDays; drill: string | undefined };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readProgressParams(raw: RawParams): ProgressParams {
  const days = Number(first(raw.range));
  const range = RANGE_DAYS.find((d) => d === days) ?? DEFAULT_RANGE;
  const drill = first(raw.drill);
  return { range, drill: drill ? drill : undefined };
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The first and last day of a range ending today, both included. Days are cut in UTC, the
 *  API's default zone. */
export function rangeDates(range: RangeDays, today: Date): { from: string; to: string } {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to.getTime() - (range - 1) * 86_400_000);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Day buckets for a week of data, week buckets for anything longer. */
export function bucketFor(range: RangeDays): "day" | "week" {
  return range <= 7 ? "day" : "week";
}

export function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Oct" from "2026-10-14". */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function dayNumber(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export const CHART = { width: 720, height: 240, left: 44, right: 16, top: 24, bottom: 32 } as const;

export type ChartPoint = {
  x: number;
  y: number;
  bucket_start: string;
  attempts: number;
  success_rate: number;
  few: boolean;
};
export type ChartBoundary = { x: number; version_number: number; scoring_changed: boolean };

export type SuccessChart = {
  points: ChartPoint[];
  line: string;
  boundaries: ChartBoundary[];
  /** Y positions for 0, 50 and 100 percent. */
  grid: { value: number; y: number }[];
  from: string;
  to: string;
  has_few: boolean;
  scoring_changed_versions: number[];
};

/** Where each bucket sits on a chart whose x axis is the date range and whose y axis is 0 to
 *  100 percent. Buckets with no attempts are not in the API response, so the line crosses
 *  the gap. A version boundary is drawn at the first bucket that used it. */
export function buildSuccessChart(stats: SuccessRateStats): SuccessChart {
  const { width, height, left, right, top, bottom } = CHART;
  const startDay = dayNumber(stats.from);
  const span = Math.max(1, dayNumber(stats.to) - startDay);
  const x = (iso: string) => left + ((dayNumber(iso) - startDay) / span) * (width - left - right);
  const y = (rate: number) => top + (1 - rate) * (height - top - bottom);

  const points = stats.points.map((p) => ({
    x: round(x(p.bucket_start)),
    y: round(y(p.success_rate)),
    bucket_start: p.bucket_start,
    attempts: p.attempts,
    success_rate: p.success_rate,
    few: p.attempts < FEW_ATTEMPTS,
  }));

  const firstVersion = stats.versions[0]?.version_number;
  const seen = new Set<number>();
  const boundaries: ChartBoundary[] = [];
  stats.points.forEach((p, index) => {
    for (const number of p.drill_version_numbers) {
      if (seen.has(number)) continue;
      seen.add(number);
      if (number === firstVersion) continue;
      const version = stats.versions.find((v) => v.version_number === number);
      boundaries.push({
        x: points[index].x,
        version_number: number,
        scoring_changed: version?.scoring_kind_changed ?? false,
      });
    }
  });

  return {
    points,
    line: points.map((p) => `${p.x},${p.y}`).join(" "),
    boundaries,
    grid: [0, 0.5, 1].map((value) => ({ value, y: round(y(value)) })),
    from: stats.from,
    to: stats.to,
    has_few: points.some((p) => p.few),
    scoring_changed_versions: stats.versions
      .filter((v) => v.scoring_kind_changed)
      .map((v) => v.version_number),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Bar heights as a share (0 to 1) of the busiest week; a week with no attempts is 0. */
export function barShares(attempts: number[]): number[] {
  const max = Math.max(0, ...attempts);
  return attempts.map((n) => (max === 0 ? 0 : n / max));
}
