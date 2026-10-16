// Table constants for the layout editor (docs/architecture.md sections 4.2 and 4.3).
// They mirror apps/api/app/services/layout_service.py, which is the source of truth for
// layout validation. Keep both sides in step when either changes. The layout types
// themselves live in api-client.ts. Keys stay snake_case (README decision 7).

import type { PocketName } from "@/lib/api-client";

export type Point = { x: number; y: number };

// Playing surface in diamond units; origin top-left, head rail at x = 0.
export const TABLE_LENGTH = 8;
export const TABLE_WIDTH = 4;
export const HEAD_STRING_X = 2;
export const FOOT_SPOT: Point = { x: 6, y: 2 };

// 9 ft table only for now (ADR 0006).
export const BALL_DIAMETER_IN = 2.25;
export const PLAYING_SURFACE_LENGTH_IN = 100;

// Balls may sit this far past a cushion or into each other, so frozen balls are valid.
export const POSITION_TOLERANCE = 0.002;
export const SNAP_STEP = 0.05;
export const FINE_STEP = 0.01;
export const MAX_OBJECT_BALLS = 15;
export const CUE_BALL_ID = "ball_0";
// The landing zone is a fixed-size circle that is never stored (ADR 0008).
export const LANDING_ZONE_RADIUS = 0.5;

// The drawing: the playing surface plus a rail band on every side.
export const RAIL_BAND = 0.45;
export const VIEW_BOX = {
  x: -RAIL_BAND,
  y: -RAIL_BAND,
  width: TABLE_LENGTH + 2 * RAIL_BAND,
  height: TABLE_WIDTH + 2 * RAIL_BAND,
};

// Pocket positions are fixed per table kind, never stored in a layout.
export const POCKETS: Record<PocketName, Point> = {
  top_left: { x: 0, y: 0 },
  top_middle: { x: 4, y: 0 },
  top_right: { x: 8, y: 0 },
  bottom_left: { x: 0, y: 4 },
  bottom_middle: { x: 4, y: 4 },
  bottom_right: { x: 8, y: 4 },
};

export const POCKET_NAMES = Object.keys(POCKETS) as PocketName[];
