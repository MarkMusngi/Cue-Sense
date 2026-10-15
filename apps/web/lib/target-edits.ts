// Pure, immutable edits to layout targets: pockets, circle zones and rect zones.
// Zones stay on the table (docs/architecture.md section 4.3): a rect fully, a circle
// by its centre.

import {
  CUE_BALL_ID,
  POCKETS,
  TABLE_LENGTH,
  TABLE_WIDTH,
  type Layout,
  type PocketName,
  type Point,
  type Target,
} from "@/lib/layout";
import { nextId } from "@/lib/layout-ids";
import { roundToMillis } from "@/lib/table-geometry";

export const DEFAULT_CIRCLE_RADIUS = 0.4;
export const DEFAULT_RECT_SIZE = { width: 1, height: 0.5 };
export const MIN_ZONE_SIZE = 0.1;
// A click this close to a pocket (in diamonds) picks it.
const POCKET_PICK_DISTANCE = 0.6;

type Zone = Extract<Target, { kind: "zone" }>;

export function findTarget(layout: Layout, id: string): Target | undefined {
  return layout.targets.find((target) => target.id === id);
}

export function nearestPocket(point: Point): PocketName | undefined {
  let nearest: PocketName | undefined;
  let nearestDistance = POCKET_PICK_DISTANCE;
  for (const [name, pocket] of Object.entries(POCKETS) as [PocketName, Point][]) {
    const distance = Math.hypot(point.x - pocket.x, point.y - pocket.y);
    if (distance <= nearestDistance) {
      nearest = name;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** A pocket target, linked to an object ball if one is given. Pockets never take the cue ball. */
export function addPocketTarget(layout: Layout, pocket: PocketName, ballId?: string): Layout {
  const target: Target = {
    id: nextId(layout, "target"),
    kind: "pocket",
    pocket,
    ...(ballId && ballId !== CUE_BALL_ID ? { ball_id: ballId } : {}),
  };
  return { ...layout, targets: [...layout.targets, target] };
}

/** A circle zone centred on the point, or a rect zone with its top-left corner there. */
export function addZone(layout: Layout, shape: "circle" | "rect", point: Point): Layout {
  const id = nextId(layout, "target");
  const zone: Zone =
    shape === "circle"
      ? { id, kind: "zone", shape, ...clampCentre(point), radius: DEFAULT_CIRCLE_RADIUS }
      : {
          id,
          kind: "zone",
          shape,
          ...clampCorner(point, DEFAULT_RECT_SIZE.width, DEFAULT_RECT_SIZE.height),
          ...DEFAULT_RECT_SIZE,
        };
  return { ...layout, targets: [...layout.targets, zone] };
}

/** Move a zone: a circle by its centre, a rect by its top-left corner. */
export function moveZone(layout: Layout, id: string, point: Point): Layout {
  return updateZone(layout, id, (zone) =>
    zone.shape === "circle"
      ? { ...zone, ...clampCentre(point) }
      : { ...zone, ...clampCorner(point, zone.width, zone.height) },
  );
}

/** Resize from a handle: a circle's radius reaches the point, a rect's far corner moves to it. */
export function resizeZone(layout: Layout, id: string, point: Point): Layout {
  return updateZone(layout, id, (zone) => {
    if (zone.shape === "circle") {
      const radius = Math.max(Math.hypot(point.x - zone.x, point.y - zone.y), MIN_ZONE_SIZE);
      return { ...zone, radius: roundToMillis(radius) };
    }
    return {
      ...zone,
      width: roundToMillis(clamp(point.x - zone.x, MIN_ZONE_SIZE, TABLE_LENGTH - zone.x)),
      height: roundToMillis(clamp(point.y - zone.y, MIN_ZONE_SIZE, TABLE_WIDTH - zone.y)),
    };
  });
}

export function removeTarget(layout: Layout, id: string): Layout {
  if (!findTarget(layout, id)) {
    return layout;
  }
  return { ...layout, targets: layout.targets.filter((target) => target.id !== id) };
}

/** Link a target to a ball, or unlink it with undefined. Pockets never take the cue ball. */
export function setTargetBall(layout: Layout, id: string, ballId: string | undefined): Layout {
  const target = findTarget(layout, id);
  if (!target || (target.kind === "pocket" && ballId === CUE_BALL_ID)) {
    return layout;
  }
  return replaceTarget(layout, id, (current) => {
    const next = { ...current };
    if (ballId === undefined) {
      delete next.ball_id;
    } else {
      next.ball_id = ballId;
    }
    return next;
  });
}

/** Set a zone's label; a blank label removes it. */
export function setZoneLabel(layout: Layout, id: string, label: string): Layout {
  const trimmed = label.trim();
  return updateZone(layout, id, (zone) => {
    const next = { ...zone };
    if (trimmed) {
      next.label = trimmed;
    } else {
      delete next.label;
    }
    return next;
  });
}

function updateZone(layout: Layout, id: string, update: (zone: Zone) => Zone): Layout {
  const target = findTarget(layout, id);
  if (!target || target.kind !== "zone") {
    return layout;
  }
  return replaceTarget(layout, id, () => update(target));
}

function replaceTarget(layout: Layout, id: string, update: (target: Target) => Target): Layout {
  return {
    ...layout,
    targets: layout.targets.map((target) => (target.id === id ? update(target) : target)),
  };
}

function clampCentre(point: Point): Point {
  return {
    x: roundToMillis(clamp(point.x, 0, TABLE_LENGTH)),
    y: roundToMillis(clamp(point.y, 0, TABLE_WIDTH)),
  };
}

function clampCorner(point: Point, width: number, height: number): Point {
  return {
    x: roundToMillis(clamp(point.x, 0, TABLE_LENGTH - width)),
    y: roundToMillis(clamp(point.y, 0, TABLE_WIDTH - height)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
