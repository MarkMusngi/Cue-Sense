import { describe, expect, it } from "vitest";

import { composite, contrastRatio, parseColor } from "@/lib/contrast";

describe("parseColor", () => {
  it("reads hex and rgba", () => {
    expect(parseColor("#5AA9E6")).toEqual({ r: 90, g: 169, b: 230, a: 1 });
    expect(parseColor("rgba(90, 169, 230, 0.14)")).toEqual({ r: 90, g: 169, b: 230, a: 0.14 });
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // A known mid pair: #767676 on white is just over AA.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#5AA9E6", "#111315")).toBeCloseTo(contrastRatio("#111315", "#5AA9E6"), 10);
  });
});

describe("composite", () => {
  it("blends a translucent colour over an opaque one", () => {
    expect(composite("rgba(255, 255, 255, 0.5)", "#000000")).toBe("#808080");
    expect(composite("#123456", "#FFFFFF")).toBe("#123456");
  });
});
