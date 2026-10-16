import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { DrillScoring, SetProgress } from "@/lib/api-client";
import { computeSetProgress, successRate, type ScoredAttempt } from "@/lib/set-progress";

type Case = {
  name: string;
  scoring: DrillScoring;
  attempts: ScoredAttempt[];
  expected: SetProgress;
};

// The cases the API's scoring service is tested with too (docs/architecture.md section 4.4).
const FIXTURE = fileURLToPath(
  new URL("../../../fixtures/scoring/set-progress-cases.json", import.meta.url),
);
const CASES = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { cases: Case[] }).cases;

describe("computeSetProgress against the shared cases", () => {
  it("has the shared cases to run", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
  });

  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, testCase) => {
    const actual = computeSetProgress(testCase.scoring, testCase.attempts);
    const { success_rate: expectedRate, ...expected } = testCase.expected;
    const { success_rate: actualRate, ...rest } = actual;

    expect(rest).toEqual(expected);
    if (expectedRate === null) {
      expect(actualRate).toBeNull();
    } else {
      expect(actualRate).toBeCloseTo(expectedRate, 9);
    }
  });
});

describe("successRate", () => {
  const attempt = (outcome: ScoredAttempt["outcome"], is_voided = false): ScoredAttempt => ({
    outcome,
    points: null,
    is_voided,
  });

  it("counts successes over non-voided attempts, and partial is not a success", () => {
    expect(successRate([attempt("success"), attempt("partial"), attempt("fail"), attempt("success")])).toBe(0.5);
  });

  it("ignores voided attempts", () => {
    expect(successRate([attempt("success"), attempt("fail", true)])).toBe(1);
  });

  it("is null without attempts", () => {
    expect(successRate([])).toBeNull();
    expect(successRate([attempt("success", true)])).toBeNull();
  });
});
