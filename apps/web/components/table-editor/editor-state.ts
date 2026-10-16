// Small shared types and helpers for the table editor's UI state.

import type { DrillLayout } from "@/lib/api-client";
import { ballLabel } from "@/lib/layout-ids";
import { allBalls } from "@/lib/layout-edits";

export type Tool = "select" | "ball" | "pocket" | "zone";

/** What is selected: a ball id, or the landing zone. */
export const LANDING_ZONE_ID = "landing_zone";

export function selectionExists(layout: DrillLayout, id: string | null): id is string {
  if (id === null) return false;
  if (id === LANDING_ZONE_ID) return Boolean(layout.landing_zone);
  return allBalls(layout).some((ball) => ball.id === id);
}

export function selectionLabel(id: string): string {
  return id === LANDING_ZONE_ID ? "Landing zone" : ballLabel(id);
}

export function selectionPosition(layout: DrillLayout, id: string): { x: number; y: number } | null {
  if (id === LANDING_ZONE_ID) return layout.landing_zone ?? null;
  return allBalls(layout).find((ball) => ball.id === id) ?? null;
}

/** "ball_3" becomes "3", for test ids. */
export function ballTestId(id: string): string {
  return id.replace(/^ball_/, "");
}

/** A spoken summary of the layout for the table's accessible name. */
export function describeLayout(layout: DrillLayout): string {
  const count = layout.object_balls.length;
  const parts = [`Pool table with the cue ball and ${count} object ball${count === 1 ? "" : "s"}`];
  if (layout.target_pocket) parts.push(`target pocket ${layout.target_pocket.replace("_", " ")}`);
  if (layout.landing_zone) parts.push("a landing zone");
  return parts.join(", ");
}
