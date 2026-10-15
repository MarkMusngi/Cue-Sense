import { describe, expect, it } from "vitest";

import { sampleLayout } from "@/lib/sample-layouts";
import {
  addPocketTarget,
  addZone,
  findTarget,
  moveZone,
  nearestPocket,
  removeTarget,
  resizeZone,
  setTargetBall,
  setZoneLabel,
} from "@/lib/target-edits";

describe("nearestPocket", () => {
  it("finds the pocket closest to a point near it", () => {
    expect(nearestPocket({ x: 7.8, y: 0.1 })).toBe("top_right");
    expect(nearestPocket({ x: 4.1, y: 4.2 })).toBe("bottom_middle");
    expect(nearestPocket({ x: -0.2, y: 4.1 })).toBe("bottom_left");
  });

  it("finds nothing in the middle of the table", () => {
    expect(nearestPocket({ x: 4, y: 2 })).toBeUndefined();
  });
});

describe("addPocketTarget", () => {
  it("adds a pocket target with the next id", () => {
    const added = addPocketTarget(sampleLayout(), "bottom_left");

    expect(added.targets.at(-1)).toEqual({ id: "target_4", kind: "pocket", pocket: "bottom_left" });
  });

  it("links an object ball", () => {
    const added = addPocketTarget(sampleLayout(), "bottom_left", "ball_1");

    expect(added.targets.at(-1)).toMatchObject({ ball_id: "ball_1" });
  });

  it("never links the cue ball to a pocket", () => {
    const added = addPocketTarget(sampleLayout(), "bottom_left", "ball_0");

    expect(added.targets.at(-1)).not.toHaveProperty("ball_id");
  });
});

describe("addZone", () => {
  it("adds a circle zone centred on the point", () => {
    const added = addZone(sampleLayout(), "circle", { x: 3, y: 2.5 });

    expect(added.targets.at(-1)).toEqual({
      id: "target_4",
      kind: "zone",
      shape: "circle",
      x: 3,
      y: 2.5,
      radius: 0.4,
    });
  });

  it("adds a rect zone from the point and keeps it on the table", () => {
    const added = addZone(sampleLayout(), "rect", { x: 7.5, y: 3.8 });

    expect(added.targets.at(-1)).toMatchObject({ shape: "rect", x: 7, y: 3.5, width: 1, height: 0.5 });
  });
});

describe("moveZone", () => {
  it("keeps a circle zone's centre on the table", () => {
    const moved = moveZone(sampleLayout(), "target_2", { x: 9, y: -1 });

    expect(moved.targets[1]).toMatchObject({ x: 8, y: 0, radius: 0.4 });
  });

  it("keeps a whole rect zone on the table", () => {
    const moved = moveZone(sampleLayout(), "target_3", { x: 7.9, y: 3.9 });

    expect(moved.targets[2]).toMatchObject({ x: 6, y: 3, width: 2, height: 1 });
  });

  it("ignores pocket targets", () => {
    const layout = sampleLayout();

    expect(moveZone(layout, "target_1", { x: 1, y: 1 })).toBe(layout);
  });
});

describe("resizeZone", () => {
  it("sets a rect zone's size from its corner to the point", () => {
    const resized = resizeZone(sampleLayout(), "target_3", { x: 7, y: 0.5 });

    expect(resized.targets[2]).toMatchObject({ x: 6, y: 0, width: 1, height: 0.5 });
  });

  it("keeps a resized rect on the table and above the minimum size", () => {
    const layout = sampleLayout();

    expect(resizeZone(layout, "target_3", { x: 9, y: 9 }).targets[2]).toMatchObject({
      width: 2,
      height: 4,
    });
    expect(resizeZone(layout, "target_3", { x: 5, y: -1 }).targets[2]).toMatchObject({
      width: 0.1,
      height: 0.1,
    });
  });

  it("sets a circle zone's radius from its centre to the point", () => {
    const layout = sampleLayout();

    expect(resizeZone(layout, "target_2", { x: 3.5, y: 2 }).targets[1]).toMatchObject({
      radius: 0.5,
    });
    expect(resizeZone(layout, "target_2", { x: 3, y: 2 }).targets[1]).toMatchObject({
      radius: 0.1,
    });
  });
});

describe("removeTarget", () => {
  it("removes the target and nothing else", () => {
    const layout = sampleLayout();

    const removed = removeTarget(layout, "target_2");

    expect(removed.targets.map((t) => t.id)).toEqual(["target_1", "target_3"]);
    expect(removed.object_balls).toBe(layout.object_balls);
  });
});

describe("setTargetBall", () => {
  it("links a zone to the cue ball or an object ball", () => {
    const layout = sampleLayout();

    expect(findTarget(setTargetBall(layout, "target_2", "ball_1"), "target_2")).toMatchObject({
      ball_id: "ball_1",
    });
  });

  it("unlinks with undefined", () => {
    const unlinked = setTargetBall(sampleLayout(), "target_1", undefined);

    expect(findTarget(unlinked, "target_1")).not.toHaveProperty("ball_id");
  });

  it("refuses to link a pocket target to the cue ball", () => {
    const layout = sampleLayout();

    expect(setTargetBall(layout, "target_1", "ball_0")).toBe(layout);
  });
});

describe("setZoneLabel", () => {
  it("sets a trimmed label and removes an empty one", () => {
    const labelled = setZoneLabel(sampleLayout(), "target_2", "  Stop here ");

    expect(findTarget(labelled, "target_2")).toMatchObject({ label: "Stop here" });
    expect(findTarget(setZoneLabel(labelled, "target_2", " "), "target_2")).not.toHaveProperty(
      "label",
    );
  });
});
