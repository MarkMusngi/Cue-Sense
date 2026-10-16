// Contract with the API: layouts the editor helpers produce, saved in
// fixtures/layouts/editor-layouts.json. The API's pytest validates every one with
// layout_service.validate_layout, so a change to either side's placement rules that
// breaks the other fails a test. Regenerate with UPDATE_EDITOR_LAYOUTS=1 pnpm --filter web test.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";
import { addBall, moveBall, setCueSpin, setLandingZone, togglePocket } from "@/lib/layout-edits";
import { placeBall, ballRadius, mirrorHorizontal, mirrorVertical } from "@/lib/table-geometry";

const FIXTURE = fileURLToPath(new URL("../../../fixtures/layouts/editor-layouts.json", import.meta.url));
const R = ballRadius();

const EMPTY: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [],
};

/** Drop a ball the way the editor does: through placeBall, snapping off. */
function dropBall(layout: DrillLayout, id: string | null, target: { x: number; y: number }) {
  const others = [layout.cue_ball, ...layout.object_balls].filter((ball) => ball.id !== id);
  const current = id === null ? target : [layout.cue_ball, ...layout.object_balls].find((b) => b.id === id)!;
  const at = placeBall(target, others, R, { isSnapping: false, fallback: { x: current.x, y: current.y } });
  return id === null ? addBall(layout, at) : moveBall(layout, id, at);
}

function fullLayout(): DrillLayout {
  let layout = dropBall(EMPTY, null, { x: 5.5, y: 1.2 });
  layout = dropBall(layout, null, { x: 6.25, y: 3 });
  layout = setLandingZone(layout, { x: 3, y: 2.5 });
  layout = setCueSpin(layout, { x: 0.4, y: -0.3 });
  return togglePocket(layout, "top_right");
}

function fifteenBalls(): DrillLayout {
  let layout = EMPTY;
  for (let i = 0; i < 15; i++) {
    layout = dropBall(layout, null, { x: 3 + (i % 5) * 0.8, y: 0.6 + Math.floor(i / 5) * 1.2 });
  }
  return layout;
}

function buildCases(): { name: string; layout: DrillLayout }[] {
  const touchingCushion = dropBall(EMPTY, "ball_0", { x: -1, y: 2 });
  const touchingBalls = dropBall(dropBall(EMPTY, null, { x: 4, y: 2 }), null, { x: 4 + 2 * R, y: 2 });
  const pushedApart = dropBall(dropBall(EMPTY, null, { x: 4, y: 2 }), null, { x: 4.05, y: 2 });
  const corner = dropBall(EMPTY, "ball_0", { x: -1, y: -1 });
  return [
    { name: "empty_table", layout: EMPTY },
    { name: "cue_ball_touching_cushion", layout: touchingCushion },
    { name: "cue_ball_in_corner", layout: corner },
    { name: "two_balls_exactly_touching", layout: touchingBalls },
    { name: "overlapping_drop_pushed_apart", layout: pushedApart },
    { name: "fifteen_object_balls", layout: fifteenBalls() },
    { name: "landing_zone_spin_and_pocket", layout: fullLayout() },
    { name: "mirrored_horizontally", layout: mirrorHorizontal(fullLayout()) },
    { name: "mirrored_vertically", layout: mirrorVertical(fullLayout()) },
  ];
}

describe("editor layouts contract", () => {
  it("matches fixtures/layouts/editor-layouts.json", () => {
    const cases = buildCases();
    if (process.env.UPDATE_EDITOR_LAYOUTS) {
      writeFileSync(FIXTURE, `${JSON.stringify({ cases }, null, 2)}\n`);
    }
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual({ cases });
  });

  it("puts the touching balls exactly one diameter apart", () => {
    const layout = buildCases().find((c) => c.name === "two_balls_exactly_touching")!.layout;
    const distance = layout.object_balls[1].x - layout.object_balls[0].x;
    expect(distance).toBeCloseTo(0.18, 3);
  });

  it("puts the cue ball exactly one radius from the cushion", () => {
    const layout = buildCases().find((c) => c.name === "cue_ball_touching_cushion")!.layout;
    expect(layout.cue_ball.x).toBe(0.09);
  });
});
