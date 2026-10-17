// Totals shown for sessions and runs on the history screens. No React.

import type { AttemptSummary } from "@/lib/api-client";
import { formatElapsed } from "@/lib/format-elapsed";

/** Makes and attempts for a run, leaving out undone attempts. */
export function totalsOf(attempts: readonly AttemptSummary[]): { made: number; taken: number } {
  const counted = attempts.filter((attempt) => attempt.voided_at === null);
  return { made: counted.filter((attempt) => attempt.outcome === "success").length, taken: counted.length };
}

/** How long a session ran, or null while it is still open. */
export function sessionDuration(startedAt: string, endedAt: string | null): string | null {
  if (endedAt === null) return null;
  return formatElapsed(Date.parse(endedAt) - Date.parse(startedAt));
}
