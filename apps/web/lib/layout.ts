// Layout JSON types and table constants (docs/architecture.md sections 4.2 and 4.3).
// They mirror the API's Pydantic models in apps/api/app/schemas/layout.py and the
// constants in apps/api/app/services/layout_service.py. Keys stay snake_case
// (README decision 7). Keep both sides in step when either changes.

export type Point = { x: number; y: number };

export type TableSizeFt = 9; // 9 ft only for now (ADR 0006)

export type Table = { kind: "pool"; size_ft: TableSizeFt };

export type BallInHand = "none" | "anywhere" | "behind_head_string";

export type CueBall = { id: string; x: number; y: number; ball_in_hand: BallInHand };

export type ObjectBall = { id: string; number?: number; x: number; y: number };

export type PocketName =
  | "top_left"
  | "top_middle"
  | "top_right"
  | "bottom_left"
  | "bottom_middle"
  | "bottom_right";

export type PocketTarget = { id: string; kind: "pocket"; pocket: PocketName; ball_id?: string };

export type CircleZoneTarget = {
  id: string;
  kind: "zone";
  shape: "circle";
  x: number;
  y: number;
  radius: number;
  ball_id?: string;
  label?: string;
};

// x and y are the top-left corner.
export type RectZoneTarget = {
  id: string;
  kind: "zone";
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  ball_id?: string;
  label?: string;
};

export type Target = PocketTarget | CircleZoneTarget | RectZoneTarget;

export type ArrowAnnotation = { id: string; kind: "arrow"; points: Point[]; label?: string };
export type LineAnnotation = { id: string; kind: "line"; points: Point[]; label?: string };
export type TextAnnotation = { id: string; kind: "text"; x: number; y: number; text: string };

export type Annotation = ArrowAnnotation | LineAnnotation | TextAnnotation;

export type Layout = {
  schema_version: 1;
  table: Table;
  cue_ball: CueBall;
  object_balls: ObjectBall[];
  targets: Target[];
  annotations: Annotation[];
};

// Playing surface in diamond units; origin top-left, head rail at x = 0.
export const TABLE_LENGTH = 8;
export const TABLE_WIDTH = 4;
export const HEAD_STRING_X = 2;

export const BALL_DIAMETER_IN = 2.25;
export const PLAYING_SURFACE_LENGTH_IN: Record<TableSizeFt, number> = { 9: 100 };
// Balls may sit this far past a cushion or into each other, so frozen balls are valid.
export const POSITION_TOLERANCE = 0.002;
export const SNAP_STEP = 0.05;
export const MAX_OBJECT_BALLS = 15;
export const MAX_ANNOTATIONS = 20;
export const CUE_BALL_ID = "ball_0";

// Pocket positions are fixed per table kind, never stored in a layout.
export const POCKETS: Record<PocketName, Point> = {
  top_left: { x: 0, y: 0 },
  top_middle: { x: 4, y: 0 },
  top_right: { x: 8, y: 0 },
  bottom_left: { x: 0, y: 4 },
  bottom_middle: { x: 4, y: 4 },
  bottom_right: { x: 8, y: 4 },
};
