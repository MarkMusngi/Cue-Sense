// Pure table geometry in diamond units (docs/architecture.md section 4.8). No React.
// The rules match the API's layout validation, so the editor never produces a layout
// the API would reject.

import {
  BALL_DIAMETER_IN,
  PLAYING_SURFACE_LENGTH_IN,
  POSITION_TOLERANCE,
  SNAP_STEP,
  TABLE_LENGTH,
  TABLE_WIDTH,
  type Layout,
  type PocketName,
  type Point,
  type TableSizeFt,
  type Target,
} from "@/lib/layout";

// Absorbs float error so balls exactly on a boundary count as valid.
const FLOAT_EPSILON = 1e-9;

export function ballRadius(sizeFt: TableSizeFt): number {
  const diamondIn = PLAYING_SURFACE_LENGTH_IN[sizeFt] / 8;
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

function insideCushions(point: Point, radius: number): boolean {
  const slack = POSITION_TOLERANCE + FLOAT_EPSILON;
  return (
    point.x - radius >= -slack &&
    point.x + radius <= TABLE_LENGTH + slack &&
    point.y - radius >= -slack &&
    point.y + radius <= TABLE_WIDTH + slack
  );
}

export function ballsOverlap(a: Point, b: Point, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 2 * radius - POSITION_TOLERANCE - FLOAT_EPSILON;
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

/** Where a dragged or dropped ball lands: snap, clamp, keep clear of other balls, round. */
export function placeBall(
  target: Point,
  others: Point[],
  radius: number,
  options: { isSnapping: boolean; fallback: Point },
): Point {
  const snapped = options.isSnapping ? snapToGrid(target) : target;
  const clamped = clampToCushions(snapped, radius);
  const placed = resolveOverlap(clamped, others, radius, options.fallback);
  return { x: roundToMillis(placed.x), y: roundToMillis(placed.y) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
 * Horizontal mirror moves the cue ball across the head string, which breaks
 * ball in hand behind the head string, so it is not offered for those drills.
 */
export function canMirrorHorizontal(layout: Layout): boolean {
  return layout.cue_ball.ball_in_hand !== "behind_head_string";
}

/** Reflect about x = 4 (head and foot swap). Ids are unchanged. */
export function mirrorHorizontal(layout: Layout): Layout {
  return mirrorLayout(
    layout,
    (p) => ({ x: roundToMillis(TABLE_LENGTH - p.x), y: p.y }),
    HORIZONTAL_POCKETS,
    (rect) => ({ ...rect, x: roundToMillis(TABLE_LENGTH - rect.x - rect.width) }),
  );
}

/** Reflect about y = 2 (top and bottom long rails swap). Ids are unchanged. */
export function mirrorVertical(layout: Layout): Layout {
  return mirrorLayout(
    layout,
    (p) => ({ x: p.x, y: roundToMillis(TABLE_WIDTH - p.y) }),
    VERTICAL_POCKETS,
    (rect) => ({ ...rect, y: roundToMillis(TABLE_WIDTH - rect.y - rect.height) }),
  );
}

type RectZone = Extract<Target, { shape: "rect" }>;

function mirrorLayout(
  layout: Layout,
  mirrorPoint: (point: Point) => Point,
  pockets: Record<PocketName, PocketName>,
  mirrorRect: (rect: RectZone) => RectZone,
): Layout {
  return {
    ...layout,
    cue_ball: { ...layout.cue_ball, ...mirrorPoint(layout.cue_ball) },
    object_balls: layout.object_balls.map((ball) => ({ ...ball, ...mirrorPoint(ball) })),
    targets: layout.targets.map((target): Target => {
      if (target.kind === "pocket") {
        return { ...target, pocket: pockets[target.pocket] };
      }
      if (target.shape === "rect") {
        return mirrorRect(target);
      }
      return { ...target, ...mirrorPoint(target) };
    }),
    annotations: layout.annotations.map((annotation) =>
      annotation.kind === "text"
        ? { ...annotation, ...mirrorPoint(annotation) }
        : { ...annotation, points: annotation.points.map(mirrorPoint) },
    ),
  };
}
