// Pure, immutable edits to layout annotations: arrows, lines and text.
// Every point stays on the table (docs/architecture.md section 4.3).

import {
  MAX_ANNOTATIONS,
  TABLE_LENGTH,
  TABLE_WIDTH,
  type Annotation,
  type Layout,
  type Point,
} from "@/lib/layout";
import { nextId } from "@/lib/layout-ids";
import { roundToMillis } from "@/lib/table-geometry";

export const DEFAULT_TEXT = "Note";

export function canAddAnnotation(layout: Layout): boolean {
  return layout.annotations.length < MAX_ANNOTATIONS;
}

export function findAnnotation(layout: Layout, id: string): Annotation | undefined {
  return layout.annotations.find((annotation) => annotation.id === id);
}

/** An arrow or line through the points. Needs at least two. */
export function addPathAnnotation(
  layout: Layout,
  kind: "arrow" | "line",
  points: Point[],
): Layout {
  if (points.length < 2 || !canAddAnnotation(layout)) {
    return layout;
  }
  const annotation: Annotation = {
    id: nextId(layout, "annotation"),
    kind,
    points: points.map(onTable),
  };
  return { ...layout, annotations: [...layout.annotations, annotation] };
}

export function addTextAnnotation(layout: Layout, point: Point, text: string = DEFAULT_TEXT): Layout {
  if (!canAddAnnotation(layout)) {
    return layout;
  }
  const annotation: Annotation = { id: nextId(layout, "annotation"), kind: "text", ...onTable(point), text };
  return { ...layout, annotations: [...layout.annotations, annotation] };
}

/** Move the whole annotation by an offset, stopping at the edge so its shape is kept. */
export function moveAnnotation(layout: Layout, id: string, offset: Point): Layout {
  const annotation = findAnnotation(layout, id);
  if (!annotation) {
    return layout;
  }
  const points = annotation.kind === "text" ? [annotation] : annotation.points;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const dx = clamp(offset.x, -Math.min(...xs), TABLE_LENGTH - Math.max(...xs));
  const dy = clamp(offset.y, -Math.min(...ys), TABLE_WIDTH - Math.max(...ys));
  const shift = (p: Point): Point => ({ x: roundToMillis(p.x + dx), y: roundToMillis(p.y + dy) });
  return replaceAnnotation(layout, id, (current) =>
    current.kind === "text"
      ? { ...current, ...shift(current) }
      : { ...current, points: current.points.map(shift) },
  );
}

/** Move one point of an arrow or line. */
export function moveAnnotationPoint(
  layout: Layout,
  id: string,
  index: number,
  point: Point,
): Layout {
  const annotation = findAnnotation(layout, id);
  if (!annotation || annotation.kind === "text" || index < 0 || index >= annotation.points.length) {
    return layout;
  }
  return replaceAnnotation(layout, id, () => ({
    ...annotation,
    points: annotation.points.map((p, i) => (i === index ? onTable(point) : p)),
  }));
}

export function removeAnnotation(layout: Layout, id: string): Layout {
  if (!findAnnotation(layout, id)) {
    return layout;
  }
  return { ...layout, annotations: layout.annotations.filter((a) => a.id !== id) };
}

/**
 * An arrow's or line's label (blank removes it), or a text annotation's text
 * (never blank, so a blank edit is ignored).
 */
export function setAnnotationText(layout: Layout, id: string, value: string): Layout {
  const annotation = findAnnotation(layout, id);
  const trimmed = value.trim();
  if (!annotation || (annotation.kind === "text" && !trimmed)) {
    return layout;
  }
  return replaceAnnotation(layout, id, () => {
    if (annotation.kind === "text") {
      return { ...annotation, text: trimmed };
    }
    const next = { ...annotation };
    if (trimmed) {
      next.label = trimmed;
    } else {
      delete next.label;
    }
    return next;
  });
}

function replaceAnnotation(
  layout: Layout,
  id: string,
  update: (annotation: Annotation) => Annotation,
): Layout {
  return {
    ...layout,
    annotations: layout.annotations.map((a) => (a.id === id ? update(a) : a)),
  };
}

function onTable(point: Point): Point {
  return {
    x: roundToMillis(clamp(point.x, 0, TABLE_LENGTH)),
    y: roundToMillis(clamp(point.y, 0, TABLE_WIDTH)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
