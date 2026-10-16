// Pure edits to a layout, one per editor action. Each returns a new layout and leaves
// the input alone, so the editor can commit the result as one undo step.

import type { DrillLayout, PocketName } from "@/lib/api-client";
import { CUE_BALL_ID, type Point } from "@/lib/layout";
import { clampSpin, type Spin } from "@/lib/cue-spin";
import { canAddBall, nextBallId } from "@/lib/layout-ids";
import { clampToTable, roundToMillis } from "@/lib/table-geometry";

/** The cue ball first, then the object balls. */
export function allBalls(layout: DrillLayout): { id: string; x: number; y: number }[] {
  return [layout.cue_ball, ...layout.object_balls];
}

/** Add an object ball, or return the layout unchanged when the table is full. */
export function addBall(layout: DrillLayout, position: Point): DrillLayout {
  if (!canAddBall(layout)) {
    return layout;
  }
  const ball = { id: nextBallId(layout), x: position.x, y: position.y };
  return { ...layout, object_balls: [...layout.object_balls, ball] };
}

export function moveBall(layout: DrillLayout, id: string, position: Point): DrillLayout {
  if (id === CUE_BALL_ID) {
    return { ...layout, cue_ball: { ...layout.cue_ball, ...position } };
  }
  return {
    ...layout,
    object_balls: layout.object_balls.map((ball) =>
      ball.id === id ? { ...ball, ...position } : ball,
    ),
  };
}

/** Remove an object ball. The cue ball cannot be removed. */
export function removeBall(layout: DrillLayout, id: string): DrillLayout {
  if (id === CUE_BALL_ID) {
    return layout;
  }
  return { ...layout, object_balls: layout.object_balls.filter((ball) => ball.id !== id) };
}

/** Set the landing zone centre (kept on the table), or clear it with null. */
export function setLandingZone(layout: DrillLayout, centre: Point | null): DrillLayout {
  const next = { ...layout };
  delete next.landing_zone;
  if (centre === null) {
    return next;
  }
  const clamped = clampToTable(centre);
  next.landing_zone = { x: roundToMillis(clamped.x), y: roundToMillis(clamped.y) };
  return next;
}

/** Set the cue spin hit point (kept inside the ball face), or clear it with null. */
export function setCueSpin(layout: DrillLayout, spin: Spin | null): DrillLayout {
  const next = { ...layout };
  delete next.cue_spin;
  if (spin === null) {
    return next;
  }
  const clamped = clampSpin(spin);
  next.cue_spin = { x: roundToMillis(clamped.x), y: roundToMillis(clamped.y) };
  return next;
}

/** Choose a target pocket; choosing the current one clears it. One per drill. */
export function togglePocket(layout: DrillLayout, pocket: PocketName): DrillLayout {
  const { target_pocket: current, ...rest } = layout;
  return current === pocket ? rest : { ...rest, target_pocket: pocket };
}
