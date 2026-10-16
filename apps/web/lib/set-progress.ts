// Set progress for a drill run, computed here so a tap can show its effect at once.
// A port of compute_set_progress in apps/api/app/services/scoring_service.py; the server's
// answer replaces it as soon as it arrives. fixtures/scoring/set-progress-cases.json holds
// the cases both sides must agree on. No React.

import type { DrillScoring, Outcome, SetProgress } from "@/lib/api-client";

export type ScoredAttempt = { outcome: Outcome; points: number | null; is_voided: boolean };

/** Successes over non-voided attempts; partial is not a success. Null without attempts. */
export function successRate(attempts: readonly ScoredAttempt[]): number | null {
  const counted = attempts.filter((attempt) => !attempt.is_voided);
  if (counted.length === 0) return null;
  return counted.filter((attempt) => attempt.outcome === "success").length / counted.length;
}

/**
 * Set progress from a run's attempts in attempt_number order. Voided attempts are ignored,
 * so they never shift set numbering. A full set stays the current set until the next
 * attempt starts the following one.
 */
export function computeSetProgress(
  scoring: DrillScoring,
  attempts: readonly ScoredAttempt[],
): SetProgress {
  const counted = attempts.filter((attempt) => !attempt.is_voided);
  const rate = successRate(counted);

  if (scoring.kind === "streak") {
    let run = 0;
    let best = 0;
    for (const attempt of counted) {
      run = attempt.outcome === "success" ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const complete = best >= scoring.streak_length;
    return {
      set_number: 1,
      attempts_in_set: counted.length,
      successes: counted.filter((attempt) => attempt.outcome === "success").length,
      points: null,
      set_complete: complete,
      set_passed: complete ? true : null,
      success_rate: rate,
      current_streak: run,
      best_streak: best,
    };
  }

  const perSet = scoring.attempts_per_set;
  const setNumber = Math.max(1, Math.ceil(counted.length / perSet));
  const inSet = counted.slice((setNumber - 1) * perSet);
  const complete = inSet.length === perSet;
  const successes = inSet.filter((attempt) => attempt.outcome === "success").length;
  const points =
    scoring.kind === "points" ? inSet.reduce((sum, attempt) => sum + (attempt.points ?? 0), 0) : null;
  const score = points ?? successes;
  return {
    set_number: setNumber,
    attempts_in_set: inSet.length,
    successes,
    points,
    set_complete: complete,
    set_passed: complete ? score >= scoring.pass_threshold : null,
    success_rate: rate,
    current_streak: null,
    best_streak: null,
  };
}
