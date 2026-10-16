import { describe, expect, it } from "vitest";

import type { DrillScoring } from "@/lib/api-client";

import { scoringLabel } from "./drill-card";

describe("scoringLabel", () => {
  it.each<[DrillScoring, string]>([
    [{ schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 7 }, "Make 7 of 10"],
    [{ schema_version: 1, kind: "streak", streak_length: 5 }, "5 in a row"],
    [
      {
        schema_version: 1,
        kind: "points",
        attempts_per_set: 10,
        max_points_per_attempt: 3,
        pass_threshold: 20,
      },
      "20 points per set",
    ],
    [
      {
        schema_version: 1,
        kind: "timed",
        attempts_per_set: 5,
        time_limit_seconds: 120,
        pass_threshold: 4,
      },
      "4 of 5 in 2 min",
    ],
  ])("describes %j", (scoring, label) => {
    expect(scoringLabel(scoring)).toBe(label);
  });
});
