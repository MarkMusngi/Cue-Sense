import type { DrillLayout, PocketName } from "@/lib/api-client";

// Read-only table drawing in diamond units (x 0 to 8, y 0 to 4). Balls are drawn
// larger than true scale so a drill reads at card size.
const BALL_RADIUS = 0.16;
// The landing zone is a fixed-size circle (ADR 0008).
const LANDING_ZONE_RADIUS = 0.5;

const POCKETS: Record<PocketName, { x: number; y: number }> = {
  top_left: { x: 0, y: 0 },
  top_middle: { x: 4, y: 0 },
  top_right: { x: 8, y: 0 },
  bottom_left: { x: 0, y: 4 },
  bottom_middle: { x: 4, y: 4 },
  bottom_right: { x: 8, y: 4 },
};

const BALL_COLORS: Record<number, string> = {
  1: "#F2C230",
  2: "#2F5FD0",
  3: "#D2412F",
  4: "#6A3FB5",
  5: "#E8782A",
  6: "#1F7A4D",
  7: "#8B2D2D",
  8: "#0B0C0D",
};

const TARGET_STYLE = {
  fill: "rgba(233,196,106,0.22)",
  stroke: "#E9C46A",
  strokeWidth: 0.04,
  strokeDasharray: "0.09 0.05",
};

/** Ball ids look like ball_3; the number picks the colour. */
export function ballNumber(id: string): number | null {
  const match = /^ball_(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

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
      <rect x="-0.45" y="-0.45" width="8.9" height="4.9" rx="0.24" fill="#4A2F1B" />
      <rect x="-0.12" y="-0.12" width="8.24" height="4.24" fill="#155C3A" />
      <rect x="0" y="0" width="8" height="4" fill="#1F7A4D" />
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
          fill={BALL_COLORS[ballNumber(ball.id) ?? 0] ?? "#E8E1CF"}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={0.012}
        />
      ))}
      <circle
        cx={layout.cue_ball.x}
        cy={layout.cue_ball.y}
        r={BALL_RADIUS}
        fill="#F7F4EC"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={0.012}
      />
    </svg>
  );
}
