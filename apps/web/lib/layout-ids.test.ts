import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";
import { ballLabel, canAddBall, nextBallId } from "@/lib/layout-ids";

function layoutWith(ids: string[]): DrillLayout {
  return {
    schema_version: 2,
    table: { kind: "pool", size_ft: 9 },
    cue_ball: { id: "ball_0", x: 2, y: 2 },
    object_balls: ids.map((id, i) => ({ id, x: 3 + i * 0.4, y: 1 })),
  };
}

describe("nextBallId", () => {
  it("starts at ball_1 for a cue ball only", () => {
    expect(nextBallId(layoutWith([]))).toBe("ball_1");
  });

  it("is one above the highest id and never fills gaps", () => {
    expect(nextBallId(layoutWith(["ball_1", "ball_4"]))).toBe("ball_5");
  });

  it("reuses the id of a removed highest-numbered ball", () => {
    expect(nextBallId(layoutWith(["ball_1", "ball_2"]))).toBe("ball_3");
    expect(nextBallId(layoutWith(["ball_1"]))).toBe("ball_2");
  });
});

describe("canAddBall", () => {
  it("allows up to 15 object balls", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `ball_${i + 1}`);
    expect(canAddBall(layoutWith(ids))).toBe(true);
    expect(canAddBall(layoutWith([...ids, "ball_15"]))).toBe(false);
  });
});

describe("ballLabel", () => {
  it("names the cue ball and numbers the rest", () => {
    expect(ballLabel("ball_0")).toBe("Cue ball");
    expect(ballLabel("ball_12")).toBe("Ball 12");
    expect(ballLabel("odd")).toBe("odd");
  });
});
