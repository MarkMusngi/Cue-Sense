// Pure, immutable edits to a layout. Each returns a new layout and never changes its input.

import type { CueBall, Layout, ObjectBall, Point } from "@/lib/layout";

export function findBall(layout: Layout, id: string): CueBall | ObjectBall | undefined {
  return layout.cue_ball.id === id
    ? layout.cue_ball
    : layout.object_balls.find((ball) => ball.id === id);
}

/** Centres of every ball except this one, for overlap checks while it moves. */
export function otherBallPositions(layout: Layout, id: string): Point[] {
  return [layout.cue_ball, ...layout.object_balls]
    .filter((ball) => ball.id !== id)
    .map(({ x, y }) => ({ x, y }));
}

export function moveBall(layout: Layout, id: string, point: Point): Layout {
  if (layout.cue_ball.id === id) {
    return { ...layout, cue_ball: { ...layout.cue_ball, x: point.x, y: point.y } };
  }
  if (!layout.object_balls.some((ball) => ball.id === id)) {
    return layout;
  }
  return {
    ...layout,
    object_balls: layout.object_balls.map((ball) =>
      ball.id === id ? { ...ball, x: point.x, y: point.y } : ball,
    ),
  };
}
