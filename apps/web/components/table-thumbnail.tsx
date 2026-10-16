import type { DrillLayout } from "@/lib/api-client";
import { ballColor, CUE_BALL_COLOR } from "@/lib/ball-colors";
import { LANDING_ZONE_RADIUS, POCKETS } from "@/lib/layout";

import { TableSurface } from "./table-surface";

export { ballNumber } from "@/lib/ball-colors";

// Read-only table drawing in diamond units (x 0 to 8, y 0 to 4). Balls are drawn
// larger than true scale so a drill reads at card size.
const BALL_RADIUS = 0.16;
const TARGET_STYLE = {
  fill: "rgba(233,196,106,0.22)",
  stroke: "#E9C46A",
  strokeWidth: 0.04,
  strokeDasharray: "0.09 0.05",
};

export function TableThumbnail({ layout, label }: { layout: DrillLayout; label: string }) {
  const pocket = layout.target_pocket ? POCKETS[layout.target_pocket] : null;
  return (
    <svg
      viewBox="-0.45 -0.45 8.9 4.9"
      role="img"
      aria-label={label}
      className="block w-full"
      data-testid="table-thumbnail"
    >
      <TableSurface />
      {pocket && <circle cx={pocket.x} cy={pocket.y} r={0.33} {...TARGET_STYLE} fill="none" />}
      {layout.landing_zone && (
        <circle
          cx={layout.landing_zone.x}
          cy={layout.landing_zone.y}
          r={LANDING_ZONE_RADIUS}
          {...TARGET_STYLE}
        />
      )}
      {layout.object_balls.map((ball) => (
        <circle
          key={ball.id}
          cx={ball.x}
          cy={ball.y}
          r={BALL_RADIUS}
          fill={ballColor(ball.id)}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={0.012}
        />
      ))}
      <circle
        cx={layout.cue_ball.x}
        cy={layout.cue_ball.y}
        r={BALL_RADIUS}
        fill={CUE_BALL_COLOR}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={0.012}
      />
    </svg>
  );
}
