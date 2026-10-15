import { describe, expect, it } from "vitest";

import {
  addObjectBall,
  findBall,
  moveBall,
  otherBallPositions,
  removeBall,
} from "@/lib/layout-edits";
import { sampleLayout } from "@/lib/sample-layouts";

describe("addObjectBall", () => {
  it("adds a ball with the next id and the lowest unused number", () => {
    const layout = sampleLayout();

    const added = addObjectBall(layout, { x: 6, y: 3 });

    expect(added.object_balls.at(-1)).toEqual({ id: "ball_2", number: 2, x: 6, y: 3 });
    expect(layout.object_balls).toHaveLength(1);
  });

  it("does not add a sixteenth object ball", () => {
    const layout = sampleLayout();
    layout.object_balls = Array.from({ length: 15 }, (_, i) => ({
      id: `ball_${i + 1}`,
      number: i + 1,
      x: 3 + (i % 8) * 0.5,
      y: 1 + Math.floor(i / 8),
    }));

    expect(addObjectBall(layout, { x: 6, y: 3.5 })).toBe(layout);
  });
});

describe("removeBall", () => {
  it("removes an object ball and clears target links to it", () => {
    const layout = sampleLayout();

    const removed = removeBall(layout, "ball_1");

    expect(removed.object_balls).toEqual([]);
    expect(removed.targets[0]).toEqual({ id: "target_1", kind: "pocket", pocket: "top_right" });
    expect(removed.targets[1]).toBe(layout.targets[1]);
  });

  it("never removes the cue ball", () => {
    const layout = sampleLayout();

    expect(removeBall(layout, "ball_0")).toBe(layout);
  });

  it("returns the same layout for an unknown id", () => {
    const layout = sampleLayout();

    expect(removeBall(layout, "ball_9")).toBe(layout);
  });
});

describe("findBall", () => {
  it("finds the cue ball and object balls by id", () => {
    const layout = sampleLayout();

    expect(findBall(layout, "ball_0")).toBe(layout.cue_ball);
    expect(findBall(layout, "ball_1")).toBe(layout.object_balls[0]);
    expect(findBall(layout, "ball_9")).toBeUndefined();
  });
});

describe("otherBallPositions", () => {
  it("lists every ball except the one given", () => {
    const layout = sampleLayout();
    layout.object_balls.push({ id: "ball_2", x: 6, y: 3 });

    expect(otherBallPositions(layout, "ball_1")).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 3 },
    ]);
    expect(otherBallPositions(layout, "ball_0")).toEqual([
      { x: 5.5, y: 1.2 },
      { x: 6, y: 3 },
    ]);
  });
});

describe("moveBall", () => {
  it("moves the cue ball and keeps its other fields", () => {
    const layout = sampleLayout();

    const moved = moveBall(layout, "ball_0", { x: 1.5, y: 1 });

    expect(moved.cue_ball).toEqual({ id: "ball_0", x: 1.5, y: 1, ball_in_hand: "none" });
  });

  it("moves one object ball and leaves the rest of the layout alone", () => {
    const layout = sampleLayout();
    const before = JSON.stringify(layout);

    const moved = moveBall(layout, "ball_1", { x: 6, y: 2 });

    expect(moved.object_balls[0]).toEqual({ id: "ball_1", number: 1, x: 6, y: 2 });
    expect(moved.targets).toBe(layout.targets);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it("returns the same layout for an unknown id", () => {
    const layout = sampleLayout();

    expect(moveBall(layout, "ball_9", { x: 1, y: 1 })).toBe(layout);
  });
});
