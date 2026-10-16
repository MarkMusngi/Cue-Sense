import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";
import {
  addBall,
  allBalls,
  moveBall,
  removeBall,
  setCueSpin,
  setLandingZone,
  togglePocket,
} from "@/lib/layout-edits";

const BASE: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
};

describe("addBall", () => {
  it("adds an object ball with the next id", () => {
    const next = addBall(BASE, { x: 4, y: 3 });
    expect(next.object_balls).toEqual([
      { id: "ball_1", x: 5.5, y: 1.2 },
      { id: "ball_2", x: 4, y: 3 },
    ]);
    expect(BASE.object_balls).toHaveLength(1);
  });

  it("does nothing once there are 15 object balls", () => {
    let full = BASE;
    for (let i = 0; i < 14; i++) {
      full = addBall(full, { x: 1 + (i % 5) * 0.4, y: 0.5 + Math.floor(i / 5) * 0.5 });
    }
    expect(full.object_balls).toHaveLength(15);
    expect(addBall(full, { x: 7, y: 3 })).toBe(full);
  });
});

describe("moveBall", () => {
  it("moves an object ball and keeps its id", () => {
    const next = moveBall(BASE, "ball_1", { x: 6, y: 2 });
    expect(next.object_balls[0]).toEqual({ id: "ball_1", x: 6, y: 2 });
  });

  it("moves the cue ball", () => {
    expect(moveBall(BASE, "ball_0", { x: 1, y: 1 }).cue_ball).toEqual({
      id: "ball_0",
      x: 1,
      y: 1,
    });
  });
});

describe("removeBall", () => {
  it("removes an object ball without renumbering the rest", () => {
    const two = addBall(BASE, { x: 4, y: 3 });
    expect(removeBall(two, "ball_1").object_balls).toEqual([{ id: "ball_2", x: 4, y: 3 }]);
  });

  it("never removes the cue ball", () => {
    expect(removeBall(BASE, "ball_0")).toBe(BASE);
  });
});

describe("setLandingZone", () => {
  it("sets the centre, kept on the table and rounded", () => {
    expect(setLandingZone(BASE, { x: 3.12349, y: 9 }).landing_zone).toEqual({ x: 3.123, y: 4 });
  });

  it("clears the zone by dropping the key", () => {
    const withZone = setLandingZone(BASE, { x: 3, y: 2 });
    expect("landing_zone" in setLandingZone(withZone, null)).toBe(false);
  });
});

describe("setCueSpin", () => {
  it("keeps the hit point inside the ball face", () => {
    const { cue_spin } = setCueSpin(BASE, { x: 1, y: 1 });
    expect(Math.hypot(cue_spin?.x ?? 9, cue_spin?.y ?? 9)).toBeLessThanOrEqual(1);
    expect(cue_spin).toEqual({ x: 0.707, y: 0.707 });
  });

  it("clears the spin by dropping the key", () => {
    const withSpin = setCueSpin(BASE, { x: 0.2, y: 0 });
    expect("cue_spin" in setCueSpin(withSpin, null)).toBe(false);
  });
});

describe("togglePocket", () => {
  it("sets one target pocket and replaces it with another", () => {
    const first = togglePocket(BASE, "top_right");
    expect(first.target_pocket).toBe("top_right");
    expect(togglePocket(first, "bottom_left").target_pocket).toBe("bottom_left");
  });

  it("clears the pocket when the same one is chosen again", () => {
    const first = togglePocket(BASE, "top_right");
    expect("target_pocket" in togglePocket(first, "top_right")).toBe(false);
  });
});

describe("allBalls", () => {
  it("lists the cue ball first", () => {
    expect(allBalls(BASE).map((ball) => ball.id)).toEqual(["ball_0", "ball_1"]);
  });
});
