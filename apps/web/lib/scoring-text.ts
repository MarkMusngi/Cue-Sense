// Words for a scoring rule, shared by the library card, the detail screen and later the
// session runner. No React.

import type { DrillScoring } from "@/lib/api-client";

/** The time limit as whole minutes when it is one ("2 min"), otherwise seconds ("90 s"). */
export function timeLimitText(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

/** The rule in a few words, e.g. "Make 6 of 10". */
export function scoringLabel(scoring: DrillScoring): string {
  switch (scoring.kind) {
    case "success_count":
      return `Make ${scoring.pass_threshold} of ${scoring.attempts_per_set}`;
    case "streak":
      return `${scoring.streak_length} in a row`;
    case "points":
      return `${scoring.pass_threshold} points per set`;
    case "timed":
      return `${scoring.pass_threshold} of ${scoring.attempts_per_set} in ${timeLimitText(scoring.time_limit_seconds)}`;
  }
}

/** The line under the headline rule, e.g. "per set of 10 attempts". */
export function scoringDetail(scoring: DrillScoring): string {
  switch (scoring.kind) {
    case "success_count":
      return `per set of ${scoring.attempts_per_set} attempts`;
    case "streak":
      return "the whole drill run is one set";
    case "points":
      return `per set of ${scoring.attempts_per_set} attempts, up to ${scoring.max_points_per_attempt} points each`;
    case "timed":
      return `within ${timeLimitText(scoring.time_limit_seconds)}, per set of ${scoring.attempts_per_set} attempts`;
  }
}
