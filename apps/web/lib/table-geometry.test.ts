import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";
import {
  ballRadius,
  ballsOverlap,
  clampToCushions,
  clampToTable,
  clientToTable,
  mirrorHorizontal,
  mirrorVertical,
  placeBall,
  resolveOverlap,
  snapToGrid,
} from "@/lib/table-geometry";

const R = ballRadius();

const LAYOUT: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 1 },
  object_balls: [
    { id: "ball_1", x: 5.5, y: 1.2 },
    { id: "ball_2", x: 6.25, y: 3 },
  ],
  landing_zone: { x: 3, y: 2.5 },
  cue_spin: { x: 0.4, y: -0.3 },
  target_pocket: "top_right",
};

describe("ballRadius", () => {
  it("is 0.09 diamonds on a 9 ft table", () => {
    expect(R).toBeCloseTo(0.09, 10);
  });
});

describe("snapToGrid", () => {
  it("snaps to the 0.05 grid and rounds float noise", () => {
    expect(snapToGrid({ x: 1.03, y: 2.97 })).toEqual({ x: 1.05, y: 2.95 });
    expect(snapToGrid({ x: 0.1 + 0.2, y: 3.1 })).toEqual({ x: 0.3, y: 3.1 });
  });

  it("takes a custom step", () => {
    expect(snapToGrid({ x: 1.234, y: 2.346 }, 0.01)).toEqual({ x: 1.23, y: 2.35 });
  });
});

describe("clampToCushions and clampToTable", () => {
  it("keeps a ball centre a radius inside every cushion", () => {
    expect(clampToCushions({ x: -3, y: 9 }, R)).toEqual({ x: R, y: 4 - R });
    expect(clampToCushions({ x: 12, y: -1 }, R)).toEqual({ x: 8 - R, y: R });
  });

  it("leaves a point already inside alone", () => {
    expect(clampToCushions({ x: 3, y: 2 }, R)).toEqual({ x: 3, y: 2 });
  });

  it("keeps a plain point on the playing surface", () => {
    expect(clampToTable({ x: -1, y: 5 })).toEqual({ x: 0, y: 4 });
  });
});

describe("ballsOverlap", () => {
  it("treats two balls exactly touching as not overlapping", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4 + 2 * R, y: 2 }, R)).toBe(false);
  });

  it("allows the validation tolerance so frozen balls are valid", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4 + 2 * R - 0.001, y: 2 }, R)).toBe(false);
  });

  it("flags a real overlap", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4.1, y: 2 }, R)).toBe(true);
  });
});

describe("placeBall", () => {
  const fallback = { x: 3, y: 3 };

  it("allows a ball exactly touching a cushion", () => {
    expect(placeBall({ x: R, y: 2 }, [], R, { isSnapping: false, fallback })).toEqual({
      x: 0.09,
      y: 2,
    });
    expect(placeBall({ x: 8 - R, y: 4 - R }, [], R, { isSnapping: false, fallback })).toEqual({
      x: 7.91,
      y: 3.91,
    });
  });

  it("clamps a ball dropped past a cushion to touching it", () => {
    expect(placeBall({ x: -2, y: 2 }, [], R, { isSnapping: false, fallback })).toEqual({
      x: 0.09,
      y: 2,
    });
  });

  it("allows two balls exactly touching", () => {
    const placed = placeBall({ x: 4 + 2 * R, y: 2 }, [{ x: 4, y: 2 }], R, {
      isSnapping: false,
      fallback,
    });
    expect(placed).toEqual({ x: 4.18, y: 2 });
  });

  it("pushes an overlapping ball out along the line between centres until they touch", () => {
    const placed = placeBall({ x: 4.1, y: 2 }, [{ x: 4, y: 2 }], R, {
      isSnapping: false,
      fallback,
    });
    expect(placed).toEqual({ x: 4.18, y: 2 });
  });

  it("pushes a ball dropped on another ball's centre towards the foot rail", () => {
    const placed = placeBall({ x: 4, y: 2 }, [{ x: 4, y: 2 }], R, { isSnapping: false, fallback });
    expect(placed).toEqual({ x: 4.18, y: 2 });
  });

  it("snaps first, then clamps, then resolves overlap", () => {
    const placed = placeBall({ x: 3.03, y: 1.97 }, [], R, { isSnapping: true, fallback });
    expect(placed).toEqual({ x: 3.05, y: 1.95 });
  });

  it("keeps the last valid position when the push would leave the table", () => {
    const placed = placeBall({ x: 7.95, y: 2 }, [{ x: 7.9, y: 2 }], R, {
      isSnapping: false,
      fallback,
    });
    expect(placed).toEqual(fallback);
  });

  it("keeps the last valid position when the push runs into a third ball", () => {
    const others = [
      { x: 4, y: 2 },
      { x: 4.18, y: 2 },
    ];
    const placed = placeBall({ x: 4.05, y: 2 }, others, R, { isSnapping: false, fallback });
    expect(placed).toEqual(fallback);
  });
});

describe("resolveOverlap", () => {
  it("returns the target when nothing overlaps", () => {
    const target = { x: 1, y: 1 };
    expect(resolveOverlap(target, [{ x: 5, y: 3 }], R, { x: 0, y: 0 })).toBe(target);
  });
});

describe("clientToTable", () => {
  const rect = { left: 100, top: 50, width: 890, height: 490 };

  it("maps the corners and the centre of the drawing", () => {
    expect(clientToTable(rect, 100, 50)).toEqual({ x: -0.45, y: -0.45 });
    expect(clientToTable(rect, 545, 295)).toEqual({ x: 4, y: 2 });
    const bottomRight = clientToTable(rect, 990, 540);
    expect(bottomRight?.x).toBeCloseTo(8.45, 10);
    expect(bottomRight?.y).toBeCloseTo(4.45, 10);
  });

  it("returns null for an element with no size", () => {
    expect(clientToTable({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toBeNull();
  });
});

describe("mirror", () => {
  it("mirrors horizontally: x flips, pocket sides swap, spin side flips, y of spin stays", () => {
    const mirrored = mirrorHorizontal(LAYOUT);

    expect(mirrored.cue_ball).toEqual({ id: "ball_0", x: 6, y: 1 });
    expect(mirrored.object_balls).toEqual([
      { id: "ball_1", x: 2.5, y: 1.2 },
      { id: "ball_2", x: 1.75, y: 3 },
    ]);
    expect(mirrored.landing_zone).toEqual({ x: 5, y: 2.5 });
    expect(mirrored.target_pocket).toBe("top_left");
    expect(mirrored.cue_spin).toEqual({ x: -0.4, y: -0.3 });
  });

  it("mirrors vertically: y flips, pocket rails swap, spin side still flips", () => {
    const mirrored = mirrorVertical(LAYOUT);

    expect(mirrored.cue_ball).toEqual({ id: "ball_0", x: 2, y: 3 });
    expect(mirrored.object_balls[0]).toEqual({ id: "ball_1", x: 5.5, y: 2.8 });
    expect(mirrored.landing_zone).toEqual({ x: 3, y: 1.5 });
    expect(mirrored.target_pocket).toBe("bottom_right");
    expect(mirrored.cue_spin).toEqual({ x: -0.4, y: -0.3 });
  });

  it("is its own inverse and keeps ids", () => {
    expect(mirrorHorizontal(mirrorHorizontal(LAYOUT))).toEqual(LAYOUT);
    expect(mirrorVertical(mirrorVertical(LAYOUT))).toEqual(LAYOUT);
    expect(mirrorHorizontal(LAYOUT).object_balls.map((b) => b.id)).toEqual(["ball_1", "ball_2"]);
  });

  it("keeps the middle pockets and a centred spin as they are", () => {
    const centred: DrillLayout = {
      ...LAYOUT,
      target_pocket: "bottom_middle",
      cue_spin: { x: 0, y: 0.5 },
    };
    const mirrored = mirrorHorizontal(centred);
    expect(mirrored.target_pocket).toBe("bottom_middle");
    expect(Object.is(mirrored.cue_spin?.x, 0)).toBe(true);
  });

  it("leaves optional parts absent when they were absent", () => {
    const bare: DrillLayout = {
      schema_version: 2,
      table: { kind: "pool", size_ft: 9 },
      cue_ball: { id: "ball_0", x: 2, y: 2 },
      object_balls: [],
    };
    const mirrored = mirrorVertical(bare);
    expect("landing_zone" in mirrored).toBe(false);
    expect("cue_spin" in mirrored).toBe(false);
    expect("target_pocket" in mirrored).toBe(false);
  });

  it("keeps schema_version and table", () => {
    const mirrored = mirrorHorizontal(LAYOUT);
    expect(mirrored.schema_version).toBe(2);
    expect(mirrored.table).toEqual({ kind: "pool", size_ft: 9 });
  });
});
