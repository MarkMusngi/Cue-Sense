import { describe, expect, it } from "vitest";

import type { AttemptSummary } from "@/lib/api-client";
import { sessionDuration, totalsOf } from "@/lib/session-summary";

function attempt(outcome: AttemptSummary["outcome"], voided = false): AttemptSummary {
  return {
    id: Math.random().toString(),
    attempt_number: 1,
    outcome,
    points: null,
    duration_ms: null,
    tapped_at: "2026-10-16T10:00:00Z",
    recorded_at: "2026-10-16T10:00:00Z",
    voided_at: voided ? "2026-10-16T10:01:00Z" : null,
    notes: null,
  };
}

describe("totalsOf", () => {
  it("counts makes over attempts, leaving out undone ones", () => {
    const attempts = [attempt("success"), attempt("fail"), attempt("success", true), attempt("partial")];
    expect(totalsOf(attempts)).toEqual({ made: 1, taken: 3 });
  });

  it("is zero for no attempts", () => {
    expect(totalsOf([])).toEqual({ made: 0, taken: 0 });
  });
});

describe("sessionDuration", () => {
  it("is the length of a finished session", () => {
    expect(sessionDuration("2026-10-16T09:00:00Z", "2026-10-16T09:42:15Z")).toBe("42:15");
    expect(sessionDuration("2026-10-16T09:00:00Z", "2026-10-16T10:02:15Z")).toBe("1:02:15");
  });

  it("is null while the session is open", () => {
    expect(sessionDuration("2026-10-16T09:00:00Z", null)).toBeNull();
  });
});
