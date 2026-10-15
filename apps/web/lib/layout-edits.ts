// Pure, immutable edits to a layout. Each returns a new layout and never changes its input.

import {
  MAX_OBJECT_BALLS,
  type CueBall,
  type Layout,
  type ObjectBall,
  type Point,
  type Target,
} from "@/lib/layout";
import { nextBallNumber, nextId } from "@/lib/layout-ids";

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

/** Add an object ball with the next free id and the lowest unused number (1 to 15). */
export function addObjectBall(layout: Layout, point: Point): Layout {
  if (layout.object_balls.length >= MAX_OBJECT_BALLS) {
    return layout;
  }
  const number = nextBallNumber(layout);
  const ball: ObjectBall = {
    id: nextId(layout, "ball"),
    ...(number === undefined ? {} : { number }),
    x: point.x,
    y: point.y,
  };
  return { ...layout, object_balls: [...layout.object_balls, ball] };
}

/**
 * Remove an object ball. Targets that named it keep their place but lose the link
 * (a pocket target then means any ball). The cue ball is never removed.
 */
export function removeBall(layout: Layout, id: string): Layout {
  if (id === layout.cue_ball.id || !layout.object_balls.some((ball) => ball.id === id)) {
    return layout;
  }
  return {
    ...layout,
    object_balls: layout.object_balls.filter((ball) => ball.id !== id),
    targets: layout.targets.map((target) => (target.ball_id === id ? unlink(target) : target)),
  };
}

function unlink(target: Target): Target {
  const unlinked = { ...target };
  delete unlinked.ball_id;
  return unlinked;
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
