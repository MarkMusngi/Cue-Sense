import { describe, expect, it } from "vitest";

import {
  addPathAnnotation,
  addTextAnnotation,
  canAddAnnotation,
  findAnnotation,
  moveAnnotation,
  moveAnnotationPoint,
  removeAnnotation,
  setAnnotationText,
} from "@/lib/annotation-edits";
import type { Layout } from "@/lib/layout";
import { sampleLayout } from "@/lib/sample-layouts";

function withAnnotations(count: number): Layout {
  const layout = sampleLayout();
  layout.annotations = Array.from({ length: count }, (_, i) => ({
    id: `annotation_${i + 1}`,
    kind: "text" as const,
    x: 1,
    y: 1,
    text: "Note",
  }));
  return layout;
}

describe("addPathAnnotation", () => {
  it("adds an arrow through the points, kept on the table and rounded", () => {
    const added = addPathAnnotation(sampleLayout(), "arrow", [
      { x: 1, y: 1 },
      { x: 9, y: -0.5 },
      { x: 2.00049, y: 3 },
    ]);

    expect(added.annotations.at(-1)).toEqual({
      id: "annotation_4",
      kind: "arrow",
      points: [
        { x: 1, y: 1 },
        { x: 8, y: 0 },
        { x: 2, y: 3 },
      ],
    });
  });

  it("needs at least two points", () => {
    const layout = sampleLayout();

    expect(addPathAnnotation(layout, "line", [{ x: 1, y: 1 }])).toBe(layout);
  });

  it("stops at 20 annotations", () => {
    const full = withAnnotations(20);
    const points = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];

    expect(canAddAnnotation(full)).toBe(false);
    expect(canAddAnnotation(withAnnotations(19))).toBe(true);
    expect(addPathAnnotation(full, "line", points)).toBe(full);
    expect(addTextAnnotation(full, { x: 1, y: 1 })).toBe(full);
  });
});

describe("addTextAnnotation", () => {
  it("adds text at the point", () => {
    const added = addTextAnnotation(sampleLayout(), { x: 7.5, y: 3.5 }, "Bank here");

    expect(added.annotations.at(-1)).toEqual({
      id: "annotation_4",
      kind: "text",
      x: 7.5,
      y: 3.5,
      text: "Bank here",
    });
  });
});

describe("moveAnnotation", () => {
  it("moves every point of an arrow by the offset", () => {
    const moved = moveAnnotation(sampleLayout(), "annotation_1", { x: 0.5, y: 0.25 });

    expect(findAnnotation(moved, "annotation_1")).toMatchObject({
      points: [
        { x: 2.5, y: 2.25 },
        { x: 6, y: 1.45 },
      ],
    });
  });

  it("stops at the edge so no point leaves the table, keeping the shape", () => {
    // annotation_2 runs from (5.5, 1.2) to (8, 0): it cannot move right or up at all.
    const moved = moveAnnotation(sampleLayout(), "annotation_2", { x: 1, y: -1 });

    expect(findAnnotation(moved, "annotation_2")).toMatchObject({
      points: [
        { x: 5.5, y: 1.2 },
        { x: 8, y: 0 },
      ],
    });
  });

  it("moves text and keeps it on the table", () => {
    const moved = moveAnnotation(sampleLayout(), "annotation_3", { x: -3, y: 0.5 });

    expect(findAnnotation(moved, "annotation_3")).toMatchObject({ x: 0, y: 1 });
  });
});

describe("moveAnnotationPoint", () => {
  it("moves one point and keeps it on the table", () => {
    const moved = moveAnnotationPoint(sampleLayout(), "annotation_1", 1, { x: 8.4, y: 3 });

    expect(findAnnotation(moved, "annotation_1")).toMatchObject({
      points: [
        { x: 2, y: 2 },
        { x: 8, y: 3 },
      ],
    });
  });

  it("ignores text annotations and unknown indexes", () => {
    const layout = sampleLayout();

    expect(moveAnnotationPoint(layout, "annotation_3", 0, { x: 1, y: 1 })).toBe(layout);
    expect(moveAnnotationPoint(layout, "annotation_1", 5, { x: 1, y: 1 })).toBe(layout);
  });
});

describe("removeAnnotation", () => {
  it("removes it and keeps the others' ids", () => {
    const removed = removeAnnotation(sampleLayout(), "annotation_2");

    expect(removed.annotations.map((a) => a.id)).toEqual(["annotation_1", "annotation_3"]);
  });
});

describe("setAnnotationText", () => {
  it("sets an arrow's label, and a blank one removes it", () => {
    const labelled = setAnnotationText(sampleLayout(), "annotation_2", " Kick path ");

    expect(findAnnotation(labelled, "annotation_2")).toMatchObject({ label: "Kick path" });
    expect(
      findAnnotation(setAnnotationText(labelled, "annotation_2", ""), "annotation_2"),
    ).not.toHaveProperty("label");
  });

  it("sets a text annotation's text but never to blank", () => {
    const layout = sampleLayout();
    const changed = setAnnotationText(layout, "annotation_3", "Follow");

    expect(findAnnotation(changed, "annotation_3")).toMatchObject({ text: "Follow" });
    expect(setAnnotationText(layout, "annotation_3", "  ")).toBe(layout);
  });
});
