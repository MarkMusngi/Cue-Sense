import { describe, expect, it } from "vitest";

import {
  ballRadius,
  ballsOverlap,
  canMirrorHorizontal,
  clampToCushions,
  clampToTable,
  mirrorHorizontal,
  mirrorVertical,
  placeBall,
  resolveOverlap,
  roundToMillis,
  snapToGrid,
} from "@/lib/table-geometry";
import { sampleLayout } from "@/lib/sample-layouts";

describe("clampToTable", () => {
  it("keeps a point on the playing surface", () => {
    expect(clampToTable({ x: -0.3, y: 4.2 })).toEqual({ x: 0, y: 4 });
    expect(clampToTable({ x: 8.4, y: -1 })).toEqual({ x: 8, y: 0 });
    expect(clampToTable({ x: 3.3, y: 1.1 })).toEqual({ x: 3.3, y: 1.1 });
  });
});

const R = 0.09;

describe("ballRadius", () => {
  it("matches the API: 0.09 diamonds on a 9 ft table", () => {
    expect(ballRadius(9)).toBeCloseTo(0.09, 10);
  });
});

describe("roundToMillis", () => {
  it("rounds to 3 decimals", () => {
    expect(roundToMillis(2.00049)).toBe(2);
    expect(roundToMillis(1.23456)).toBe(1.235);
  });
});

describe("snapToGrid", () => {
  it("snaps to the nearest 0.05 by default", () => {
    expect(snapToGrid({ x: 2.024, y: 1.226 })).toEqual({ x: 2.0, y: 1.25 });
  });

  it("takes another step", () => {
    expect(snapToGrid({ x: 2.3, y: 0.74 }, 0.5)).toEqual({ x: 2.5, y: 0.5 });
  });
});

describe("clampToCushions", () => {
  it("keeps the whole ball on the table", () => {
    expect(clampToCushions({ x: -1, y: 9 }, R)).toEqual({ x: R, y: 4 - R });
    expect(clampToCushions({ x: 8.5, y: -0.2 }, R)).toEqual({ x: 8 - R, y: R });
  });

  it("leaves a ball already inside alone, including one frozen to a rail", () => {
    expect(clampToCushions({ x: R, y: 2 }, R)).toEqual({ x: R, y: 2 });
  });
});

describe("ballsOverlap", () => {
  it("allows balls exactly touching", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4.18, y: 2 }, R)).toBe(false);
  });

  it("allows overlap within the 0.002 tolerance, as the API does", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4.178, y: 2 }, R)).toBe(false);
  });

  it("flags overlap past the tolerance", () => {
    expect(ballsOverlap({ x: 4, y: 2 }, { x: 4.177, y: 2 }, R)).toBe(true);
  });
});

describe("resolveOverlap", () => {
  it("pushes the ball out along the centre line until it touches", () => {
    const placed = resolveOverlap({ x: 4.1, y: 2 }, [{ x: 4, y: 2 }], R, { x: 6, y: 2 });

    expect(placed.x).toBeCloseTo(4.18, 6);
    expect(placed.y).toBeCloseTo(2, 6);
  });

  it("keeps a non-overlapping position", () => {
    expect(resolveOverlap({ x: 5, y: 2 }, [{ x: 4, y: 2 }], R, { x: 6, y: 2 })).toEqual({
      x: 5,
      y: 2,
    });
  });

  it("falls back when pushing out still overlaps another ball", () => {
    // The gap between these two is too narrow for a third ball.
    const others = [
      { x: 4, y: 2 },
      { x: 4.3, y: 2 },
    ];

    expect(ballsOverlap({ x: 4.15, y: 2 }, others[0], R)).toBe(true);
    expect(resolveOverlap({ x: 4.15, y: 2 }, others, R, { x: 6, y: 3 })).toEqual({
      x: 6,
      y: 3,
    });
  });

  it("falls back when pushing out would leave the table", () => {
    const placed = resolveOverlap({ x: R, y: 2.05 }, [{ x: R + 0.05, y: 2 }], R, { x: 1, y: 1 });

    expect(placed).toEqual({ x: 1, y: 1 });
  });
});

describe("placeBall", () => {
  it("snaps, clamps, keeps clear of other balls and rounds", () => {
    const placed = placeBall({ x: 4.13, y: 2.01 }, [{ x: 4, y: 2 }], R, {
      isSnapping: true,
      fallback: { x: 6, y: 2 },
    });

    expect(placed).toEqual({ x: 4.18, y: 2 });
  });

  it("does not snap when snapping is off", () => {
    expect(
      placeBall({ x: 3.333, y: 1.111 }, [], R, { isSnapping: false, fallback: { x: 1, y: 1 } }),
    ).toEqual({ x: 3.333, y: 1.111 });
  });

  it("clamps a ball dropped off the table", () => {
    expect(placeBall({ x: 9, y: 2 }, [], R, { isSnapping: false, fallback: { x: 1, y: 1 } })).toEqual(
      { x: 7.91, y: 2 },
    );
  });
});

describe("mirrorHorizontal", () => {
  it("reflects every position about x = 4 and swaps left and right pockets", () => {
    const mirrored = mirrorHorizontal(sampleLayout());

    expect(mirrored.cue_ball).toMatchObject({ x: 6, y: 2 });
    expect(mirrored.object_balls[0]).toMatchObject({ x: 2.5, y: 1.2 });
    expect(mirrored.targets[0]).toMatchObject({ pocket: "top_left" });
    expect(mirrored.targets[1]).toMatchObject({ x: 5, y: 2, radius: 0.4 });
    expect(mirrored.targets[2]).toMatchObject({ x: 0, y: 0, width: 2, height: 1 });
    expect(mirrored.annotations[0]).toMatchObject({
      points: [
        { x: 6, y: 2 },
        { x: 2.5, y: 1.2 },
      ],
    });
    expect(mirrored.annotations[2]).toMatchObject({ x: 7, y: 0.5 });
  });

  it("keeps ids and does not change its input", () => {
    const layout = sampleLayout();
    const before = JSON.stringify(layout);

    const mirrored = mirrorHorizontal(layout);

    expect(JSON.stringify(layout)).toBe(before);
    expect(mirrored.targets.map((t) => t.id)).toEqual(layout.targets.map((t) => t.id));
  });

  it("is its own inverse", () => {
    const layout = sampleLayout();

    expect(mirrorHorizontal(mirrorHorizontal(layout))).toEqual(layout);
  });
});

describe("mirrorVertical", () => {
  it("reflects every position about y = 2 and swaps top and bottom pockets", () => {
    const mirrored = mirrorVertical(sampleLayout());

    expect(mirrored.object_balls[0]).toMatchObject({ x: 5.5, y: 2.8 });
    expect(mirrored.targets[0]).toMatchObject({ pocket: "bottom_right" });
    expect(mirrored.targets[2]).toMatchObject({ x: 6, y: 3, width: 2, height: 1 });
    expect(mirrored.annotations[1]).toMatchObject({
      points: [
        { x: 5.5, y: 2.8 },
        { x: 8, y: 4 },
      ],
    });
  });

  it("keeps middle pockets in the middle", () => {
    const layout = sampleLayout();
    layout.targets[0] = { id: "target_1", kind: "pocket", pocket: "top_middle" };

    expect(mirrorVertical(layout).targets[0]).toMatchObject({ pocket: "bottom_middle" });
    expect(mirrorHorizontal(layout).targets[0]).toMatchObject({ pocket: "top_middle" });
  });

  it("is its own inverse", () => {
    const layout = sampleLayout();

    expect(mirrorVertical(mirrorVertical(layout))).toEqual(layout);
  });
});

describe("canMirrorHorizontal", () => {
  it("is false when the cue ball is in hand behind the head string", () => {
    const layout = sampleLayout();
    layout.cue_ball.ball_in_hand = "behind_head_string";

    expect(canMirrorHorizontal(layout)).toBe(false);
  });

  it("is true otherwise", () => {
    expect(canMirrorHorizontal(sampleLayout())).toBe(true);
  });
});
