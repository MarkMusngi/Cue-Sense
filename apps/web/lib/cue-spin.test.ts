import { describe, expect, it } from "vitest";

import { clampSpin, describeSpin } from "@/lib/cue-spin";

describe("clampSpin", () => {
  it("keeps a point already on the cue ball face", () => {
    expect(clampSpin({ x: 0.3, y: -0.4 })).toEqual({ x: 0.3, y: -0.4 });
  });

  it("pulls a point outside the face back to the edge", () => {
    const { x, y } = clampSpin({ x: 3, y: 4 });

    expect(x).toBeCloseTo(0.6, 10);
    expect(y).toBeCloseTo(0.8, 10);
  });
});

describe("describeSpin", () => {
  it.each([
    [{ x: 0, y: 0 }, "Center ball"],
    [{ x: 0.05, y: -0.08 }, "Center ball"],
    [{ x: 0, y: -0.4 }, "Slightly below center (draw)"],
    [{ x: 0, y: -0.8 }, "Below center (draw)"],
    [{ x: 0, y: 0.7 }, "Above center (follow)"],
    [{ x: -0.6, y: 0 }, "Left side"],
    [{ x: 0.3, y: 0 }, "Slight right side"],
    [{ x: 0.5, y: -0.5 }, "Below center (draw), right side"],
    [{ x: -0.3, y: 0.3 }, "Slightly above center (follow), slight left side"],
  ])("%o reads as %s", (spin, text) => {
    expect(describeSpin(spin)).toBe(text);
  });
});
