import type { Layout } from "@/lib/layout";

// The example layout from docs/architecture.md section 4.3, shared by unit tests and
// the dev preview page. Returns a fresh copy so callers can change it freely.
export function sampleLayout(): Layout {
  return {
    schema_version: 1,
    table: { kind: "pool", size_ft: 9 },
    cue_ball: { id: "ball_0", x: 2.0, y: 2.0, ball_in_hand: "none" },
    object_balls: [{ id: "ball_1", number: 1, x: 5.5, y: 1.2 }],
    targets: [
      { id: "target_1", kind: "pocket", pocket: "top_right", ball_id: "ball_1" },
      {
        id: "target_2",
        kind: "zone",
        shape: "circle",
        ball_id: "ball_0",
        x: 3.0,
        y: 2.0,
        radius: 0.4,
        label: "Cue ball finish",
      },
      {
        id: "target_3",
        kind: "zone",
        shape: "rect",
        ball_id: "ball_0",
        x: 6.0,
        y: 0.0,
        width: 2.0,
        height: 1.0,
        label: "Foot-rail box",
      },
    ],
    annotations: [
      {
        id: "annotation_1",
        kind: "arrow",
        points: [
          { x: 2.0, y: 2.0 },
          { x: 5.5, y: 1.2 },
        ],
        label: "Aim line",
      },
      {
        id: "annotation_2",
        kind: "line",
        points: [
          { x: 5.5, y: 1.2 },
          { x: 8.0, y: 0.0 },
        ],
      },
      { id: "annotation_3", kind: "text", x: 1.0, y: 0.5, text: "Stun, no side spin" },
    ],
  };
}
