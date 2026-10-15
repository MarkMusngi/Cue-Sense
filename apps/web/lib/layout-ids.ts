// Element ids follow <kind>_<n> and are never renumbered, so they stay stable across
// drill versions (docs/architecture.md section 4.3).

import { MAX_OBJECT_BALLS, type Layout } from "@/lib/layout";

export type ElementKind = "ball" | "target" | "annotation";

/** One above the highest existing id of this kind, so removed ids are never reused. */
export function nextId(layout: Layout, kind: ElementKind): string {
  const ids =
    kind === "ball"
      ? [layout.cue_ball.id, ...layout.object_balls.map((ball) => ball.id)]
      : kind === "target"
        ? layout.targets.map((target) => target.id)
        : layout.annotations.map((annotation) => annotation.id);
  const pattern = new RegExp(`^${kind}_(\\d+)$`);
  const highest = ids.reduce((max, id) => {
    const match = pattern.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${kind}_${highest + 1}`;
}

/** The smallest ball number from 1 to 15 not used yet, if any. */
export function nextBallNumber(layout: Layout): number | undefined {
  const used = new Set(layout.object_balls.map((ball) => ball.number));
  for (let number = 1; number <= MAX_OBJECT_BALLS; number++) {
    if (!used.has(number)) {
      return number;
    }
  }
  return undefined;
}
