import { describe, expect, it } from "vitest";

import type { SuccessRateStats } from "@/lib/api-client";
import {
  barShares,
  bucketFor,
  buildSuccessChart,
  CHART,
  percent,
  rangeDates,
  readProgressParams,
  shortDate,
} from "@/lib/stats";

describe("readProgressParams", () => {
  it("defaults to 30 days and no drill", () => {
    expect(readProgressParams({})).toEqual({ range: 30, drill: undefined });
  });

  it("accepts the three ranges and a drill", () => {
    expect(readProgressParams({ range: "7", drill: "d1" })).toEqual({ range: 7, drill: "d1" });
    expect(readProgressParams({ range: ["90"] }).range).toBe(90);
  });

  it("falls back for a range it does not offer", () => {
    expect(readProgressParams({ range: "365" }).range).toBe(30);
    expect(readProgressParams({ range: "abc" }).range).toBe(30);
    expect(readProgressParams({ drill: "" }).drill).toBeUndefined();
  });
});

describe("rangeDates", () => {
  it("includes today and the days before it", () => {
    expect(rangeDates(7, new Date("2026-10-17T23:30:00Z"))).toEqual({
      from: "2026-10-11",
      to: "2026-10-17",
    });
    expect(rangeDates(30, new Date("2026-10-17T00:00:00Z"))).toEqual({
      from: "2026-09-18",
      to: "2026-10-17",
    });
  });
});

describe("small formatters", () => {
  it("uses day buckets for a week and week buckets for more", () => {
    expect(bucketFor(7)).toBe("day");
    expect(bucketFor(30)).toBe("week");
    expect(bucketFor(90)).toBe("week");
  });

  it("formats rates, with a dash for none", () => {
    expect(percent(0.6905)).toBe("69%");
    expect(percent(0)).toBe("0%");
    expect(percent(null)).toBe("—");
  });

  it("formats dates", () => {
    expect(shortDate("2026-10-04")).toBe("4 Oct");
  });

  it("scales bars to the busiest week", () => {
    expect(barShares([0, 50, 100])).toEqual([0, 0.5, 1]);
    expect(barShares([0, 0])).toEqual([0, 0]);
    expect(barShares([])).toEqual([]);
  });
});

function stats(overrides: Partial<SuccessRateStats> = {}): SuccessRateStats {
  return {
    drill_id: "d1",
    bucket: "week",
    from: "2026-10-01",
    to: "2026-10-31",
    points: [],
    versions: [],
    ...overrides,
  };
}

function point(bucket_start: string, attempts: number, rate: number, versions: number[]) {
  return {
    bucket_start,
    attempts,
    successes: Math.round(attempts * rate),
    success_rate: rate,
    drill_run_count: 1,
    drill_version_numbers: versions,
  };
}

describe("buildSuccessChart", () => {
  it("is empty without points", () => {
    const chart = buildSuccessChart(stats());

    expect(chart.points).toEqual([]);
    expect(chart.line).toBe("");
    expect(chart.boundaries).toEqual([]);
  });

  it("puts the range start at the left edge, the end at the right and 100 percent at the top", () => {
    const chart = buildSuccessChart(
      stats({ points: [point("2026-10-01", 10, 1, [1]), point("2026-10-31", 10, 0, [1])] }),
    );

    expect(chart.points[0].x).toBe(CHART.left);
    expect(chart.points[1].x).toBe(CHART.width - CHART.right);
    expect(chart.points[0].y).toBe(CHART.top);
    expect(chart.points[1].y).toBe(CHART.height - CHART.bottom);
    expect(chart.grid.map((g) => g.value)).toEqual([0, 0.5, 1]);
  });

  it("spaces points by date, so a gap shows as distance", () => {
    const chart = buildSuccessChart(
      stats({
        points: [
          point("2026-10-01", 10, 0.5, [1]),
          point("2026-10-02", 10, 0.5, [1]),
          point("2026-10-31", 10, 0.5, [1]),
        ],
      }),
    );

    expect(chart.points[1].x - chart.points[0].x).toBeLessThan(
      chart.points[2].x - chart.points[1].x,
    );
  });

  it("fades points with fewer than five attempts", () => {
    const chart = buildSuccessChart(
      stats({ points: [point("2026-10-05", 2, 0.5, [1]), point("2026-10-12", 5, 0.6, [1])] }),
    );

    expect(chart.points.map((p) => p.few)).toEqual([true, false]);
    expect(chart.has_few).toBe(true);
  });

  it("marks where each later version first appears, not the first version", () => {
    const chart = buildSuccessChart(
      stats({
        points: [
          point("2026-10-05", 8, 0.5, [1]),
          point("2026-10-12", 8, 0.5, [1, 2]),
          point("2026-10-19", 8, 0.6, [2]),
          point("2026-10-26", 8, 0.6, [2, 3]),
        ],
        versions: [
          { drill_version_id: "a", version_number: 1, scoring_kind: "success_count", first_attempt_at: "x", scoring_kind_changed: false },
          { drill_version_id: "b", version_number: 2, scoring_kind: "success_count", first_attempt_at: "x", scoring_kind_changed: false },
          { drill_version_id: "c", version_number: 3, scoring_kind: "timed", first_attempt_at: "x", scoring_kind_changed: true },
        ],
      }),
    );

    expect(chart.boundaries.map((b) => [b.version_number, b.scoring_changed])).toEqual([
      [2, false],
      [3, true],
    ]);
    expect(chart.boundaries[0].x).toBe(chart.points[1].x);
    expect(chart.boundaries[1].x).toBe(chart.points[3].x);
    expect(chart.scoring_changed_versions).toEqual([3]);
  });
});
