// Ball ids follow ball_<n> and are never renumbered, so they stay stable across drill
// versions (docs/architecture.md section 4.3).

import type { DrillLayout } from "@/lib/api-client";
import { MAX_OBJECT_BALLS } from "@/lib/layout";

/**
 * One above the highest existing ball id. Ids below it are never reused, but removing
 * the highest-numbered ball frees its id for the next one added.
 */
export function nextBallId(layout: DrillLayout): string {
  const highest = [layout.cue_ball, ...layout.object_balls].reduce((max, ball) => {
    const match = /^ball_(\d+)$/.exec(ball.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `ball_${highest + 1}`;
}

export function canAddBall(layout: DrillLayout): boolean {
  return layout.object_balls.length < MAX_OBJECT_BALLS;
}

/** "Cue ball" for ball_0, otherwise "Ball 3". */
export function ballLabel(id: string): string {
  const match = /^ball_(\d+)$/.exec(id);
  if (!match) return id;
  return Number(match[1]) === 0 ? "Cue ball" : `Ball ${Number(match[1])}`;
}
