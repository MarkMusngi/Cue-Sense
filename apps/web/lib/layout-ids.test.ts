import { describe, expect, it } from "vitest";

import { nextBallNumber, nextId } from "@/lib/layout-ids";
import { sampleLayout } from "@/lib/sample-layouts";

describe("nextId", () => {
  it("is one above the highest existing id of that kind", () => {
    const layout = sampleLayout();

    expect(nextId(layout, "ball")).toBe("ball_2");
    expect(nextId(layout, "target")).toBe("target_4");
    expect(nextId(layout, "annotation")).toBe("annotation_4");
  });

  it("never reuses a removed id, so ids stay stable", () => {
    const layout = sampleLayout();
    layout.object_balls = [{ id: "ball_7", x: 5, y: 2 }];

    expect(nextId(layout, "ball")).toBe("ball_8");
  });

  it("starts at 1 when there are none, skipping the cue ball's ball_0", () => {
    const layout = sampleLayout();
    layout.object_balls = [];
    layout.targets = [];

    expect(nextId(layout, "ball")).toBe("ball_1");
    expect(nextId(layout, "target")).toBe("target_1");
  });
});

describe("nextBallNumber", () => {
  it("is the smallest unused number from 1 to 15", () => {
    const layout = sampleLayout();
    layout.object_balls = [
      { id: "ball_1", number: 1, x: 5, y: 1 },
      { id: "ball_2", number: 3, x: 5, y: 2 },
      { id: "ball_3", x: 5, y: 3 },
    ];

    expect(nextBallNumber(layout)).toBe(2);
  });

  it("is undefined when all fifteen are used", () => {
    const layout = sampleLayout();
    layout.object_balls = Array.from({ length: 15 }, (_, i) => ({
      id: `ball_${i + 1}`,
      number: i + 1,
      x: 3 + (i % 8) * 0.5,
      y: 1 + Math.floor(i / 8),
    }));

    expect(nextBallNumber(layout)).toBeUndefined();
  });
});
