// Pure table geometry in diamond units (docs/architecture.md section 4.8). No React.
// The rules match the API's layout validation, so the editor never produces a layout
// the API would reject.

import type { DrillLayout, PocketName } from "@/lib/api-client";
import {
  BALL_DIAMETER_IN,
  PLAYING_SURFACE_LENGTH_IN,
  POSITION_TOLERANCE,
  SNAP_STEP,
  TABLE_LENGTH,
  TABLE_WIDTH,
  VIEW_BOX,
  type Point,
} from "@/lib/layout";

// Absorbs float error so balls exactly on a boundary count as valid.
const FLOAT_EPSILON = 1e-9;

/** Ball radius in diamonds: half a ball diameter over one diamond (0.09 on a 9 ft table). */
export function ballRadius(): number {
  const diamondIn = PLAYING_SURFACE_LENGTH_IN / 8;
  return BALL_DIAMETER_IN / 2 / diamondIn;
}

export function roundToMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function snapToGrid(point: Point, step: number = SNAP_STEP): Point {
  return {
    x: roundToMillis(Math.round(point.x / step) * step),
    y: roundToMillis(Math.round(point.y / step) * step),
  };
}

export function clampToCushions(point: Point, radius: number): Point {
  return {
    x: Math.min(Math.max(point.x, radius), TABLE_LENGTH - radius),
    y: Math.min(Math.max(point.y, radius), TABLE_WIDTH - radius),
  };
}

/** Keep a point (the landing zone centre) on the playing surface. */
export function clampToTable(point: Point): Point {
  return clampToCushions(point, 0);
}

function insideCushions(point: Point, radius: number): boolean {
  const slack = POSITION_TOLERANCE + FLOAT_EPSILON;
  return (
    point.x - radius >= -slack &&
    point.x + radius <= TABLE_LENGTH + slack &&
    point.y - radius >= -slack &&
    point.y + radius <= TABLE_WIDTH + slack
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** True when two balls overlap by more than the validation tolerance. */
export function ballsOverlap(a: Point, b: Point, radius: number): boolean {
  return distance(a, b) < 2 * radius - POSITION_TOLERANCE - FLOAT_EPSILON;
}

/**
 * Move a ball off the nearest ball it overlaps, along the line between their centres,
 * until the two touch. Returns fallback (usually the last valid position) if that
 * leaves the table or still overlaps another ball.
 */
export function resolveOverlap(
  target: Point,
  others: Point[],
  radius: number,
  fallback: Point,
): Point {
  const overlapping = others
    .filter((other) => ballsOverlap(target, other, radius))
    .sort((a, b) => distance(target, a) - distance(target, b));
  if (overlapping.length === 0) {
    return target;
  }
  const nearest = overlapping[0];
  const dx = target.x - nearest.x;
  const dy = target.y - nearest.y;
  const length = Math.hypot(dx, dy);
  // Dropped exactly on another ball's centre: push towards the foot rail.
  const [ux, uy] = length === 0 ? [1, 0] : [dx / length, dy / length];
  const pushed = { x: nearest.x + ux * 2 * radius, y: nearest.y + uy * 2 * radius };
  const stillOverlaps = others.some((other) => ballsOverlap(pushed, other, radius));
  return insideCushions(pushed, radius) && !stillOverlaps ? pushed : fallback;
}

/**
 * Where a dragged or dropped ball lands: snap, clamp to the cushions, keep clear of
 * other balls, round. fallback is the last valid position, used when no clear spot
 * can be found.
 */
export function placeBall(
  target: Point,
  others: Point[],
  radius: number,
  options: { isSnapping: boolean; fallback: Point; step?: number },
): Point {
  const snapped = options.isSnapping ? snapToGrid(target, options.step) : target;
  const clamped = clampToCushions(snapped, radius);
  const placed = resolveOverlap(clamped, others, radius, options.fallback);
  return { x: roundToMillis(placed.x), y: roundToMillis(placed.y) };
}

/**
 * A free spot for a new ball, searching outward from start on a 0.4 grid. For adding a
 * ball without a pointer. Null when the table has no room left.
 */
export function findFreeSpot(
  others: Point[],
  radius: number,
  start: Point = { x: TABLE_LENGTH / 2, y: TABLE_WIDTH / 2 },
): Point | null {
  const step = 4 * radius + 0.04;
  for (let ring = 0; ring <= 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const candidate = clampToCushions(
          { x: roundToMillis(start.x + dx * step), y: roundToMillis(start.y + dy * step) },
          radius,
        );
        if (!others.some((other) => ballsOverlap(candidate, other, radius))) {
          return candidate;
        }
      }
    }
  }
  return null;
}

/**
 * A pointer position in client pixels as table units. The svg keeps the viewBox
 * aspect ratio (width 100%, height auto), so the bounding rect maps straight onto it.
 */
export function clientToTable(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Point | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: VIEW_BOX.x + ((clientX - rect.left) / rect.width) * VIEW_BOX.width,
    y: VIEW_BOX.y + ((clientY - rect.top) / rect.height) * VIEW_BOX.height,
  };
}

const HORIZONTAL_POCKETS: Record<PocketName, PocketName> = {
  top_left: "top_right",
  top_middle: "top_middle",
  top_right: "top_left",
  bottom_left: "bottom_right",
  bottom_middle: "bottom_middle",
  bottom_right: "bottom_left",
};

const VERTICAL_POCKETS: Record<PocketName, PocketName> = {
  top_left: "bottom_left",
  top_middle: "bottom_middle",
  top_right: "bottom_right",
  bottom_left: "top_left",
  bottom_middle: "top_middle",
  bottom_right: "top_right",
};

/**
 * Reflect a layout. A reflection reverses handedness, so left and right swap for the
 * cue spin (x) while follow and draw (y) stay as they are. Ids are unchanged.
 */
function mirrorLayout(
  layout: DrillLayout,
  mirrorPoint: (point: Point) => Point,
  pockets: Record<PocketName, PocketName>,
): DrillLayout {
  const { landing_zone, cue_spin, target_pocket, ...rest } = layout;
  const mirrored: DrillLayout = {
    ...rest,
    cue_ball: { ...layout.cue_ball, ...mirrorPoint(layout.cue_ball) },
    object_balls: layout.object_balls.map((ball) => ({ ...ball, ...mirrorPoint(ball) })),
  };
  if (landing_zone) {
    mirrored.landing_zone = mirrorPoint(landing_zone);
  }
  if (cue_spin) {
    // 0 - x, not -x, so a centred spin stays +0.
    mirrored.cue_spin = { x: roundToMillis(0 - cue_spin.x), y: cue_spin.y };
  }
  if (target_pocket) {
    mirrored.target_pocket = pockets[target_pocket];
  }
  return mirrored;
}

/** Reflect about x = 4 (head and foot swap). */
export function mirrorHorizontal(layout: DrillLayout): DrillLayout {
  return mirrorLayout(
    layout,
    (p) => ({ x: roundToMillis(TABLE_LENGTH - p.x), y: p.y }),
    HORIZONTAL_POCKETS,
  );
}

/** Reflect about y = 2 (the two long rails swap). */
export function mirrorVertical(layout: DrillLayout): DrillLayout {
  return mirrorLayout(
    layout,
    (p) => ({ x: p.x, y: roundToMillis(TABLE_WIDTH - p.y) }),
    VERTICAL_POCKETS,
  );
}
