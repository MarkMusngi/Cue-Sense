import { describe, expect, it } from "vitest";

import type { DrillScoring } from "@/lib/api-client";
import { scoringDetail, scoringLabel, timeLimitText } from "@/lib/scoring-text";

describe("timeLimitText", () => {
  it.each([
    [120, "2 min"],
    [60, "1 min"],
    [90, "90 s"],
    [45, "45 s"],
    [1, "1 s"],
  ])("writes %i seconds as %s", (seconds, text) => {
    expect(timeLimitText(seconds)).toBe(text);
  });
});

describe("scoringLabel", () => {
  it.each<[DrillScoring, string]>([
    [
      { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 7 },
      "Make 7 of 10",
    ],
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
    [
      {
        schema_version: 1,
        kind: "timed",
        attempts_per_set: 5,
        time_limit_seconds: 90,
        pass_threshold: 4,
      },
      "4 of 5 in 90 s",
    ],
  ])("describes %j", (scoring, label) => {
    expect(scoringLabel(scoring)).toBe(label);
  });
});

describe("scoringDetail", () => {
  it.each<[DrillScoring, string]>([
    [
      { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 6 },
      "per set of 10 attempts",
    ],
    [{ schema_version: 1, kind: "streak", streak_length: 5 }, "the whole drill run is one set"],
    [
      {
        schema_version: 1,
        kind: "points",
        attempts_per_set: 10,
        max_points_per_attempt: 3,
        pass_threshold: 20,
      },
      "per set of 10 attempts, up to 3 points each",
    ],
    [
      {
        schema_version: 1,
        kind: "timed",
        attempts_per_set: 5,
        time_limit_seconds: 120,
        pass_threshold: 4,
      },
      "within 2 min, per set of 5 attempts",
    ],
    [
      {
        schema_version: 1,
        kind: "timed",
        attempts_per_set: 5,
        time_limit_seconds: 90,
        pass_threshold: 4,
      },
      "within 90 s, per set of 5 attempts",
    ],
  ])("describes %j", (scoring, detail) => {
    expect(scoringDetail(scoring)).toBe(detail);
  });
});
