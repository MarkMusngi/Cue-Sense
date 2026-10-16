import { HEAD_STRING_X, FOOT_SPOT, RAIL_BAND, TABLE_LENGTH, TABLE_WIDTH } from "@/lib/layout";

// Physical colours of the table, the same in both themes (docs/design-system.md).
const RAIL = "#4A2F1B";
const CUSHION = "#155C3A";
const FELT = "#1F7A4D";
const DIAMOND = "#E8E1CF";
const POCKET_HOLE = "#0B0C0D";

// Pocket holes sit a little outside the corner, so the cushions seem to curve into them.
const POCKET_HOLES = [
  { cx: -0.07, cy: -0.07, r: 0.22 },
  { cx: 4, cy: -0.14, r: 0.2 },
  { cx: 8.07, cy: -0.07, r: 0.22 },
  { cx: -0.07, cy: 4.07, r: 0.22 },
  { cx: 4, cy: 4.14, r: 0.2 },
  { cx: 8.07, cy: 4.07, r: 0.22 },
];

// Rail diamonds: every diamond on the long rails except the pocket and head/foot marks.
const LONG_RAIL_X = [1, 2, 3, 5, 6, 7];
const SHORT_RAIL_Y = [1, 2, 3];

function diamond(cx: number, cy: number): string {
  const h = 0.035;
  return `M${cx} ${cy - h} L${cx + h} ${cy} L${cx} ${cy + h} L${cx - h} ${cy} Z`;
}

type TableSurfaceProps = {
  /** Add the head string, spots, rail diamonds and pocket holes. Plain is rail and felt only. */
  detailed?: boolean;
};

/** The table drawing in diamond units, to sit inside an svg with the table's viewBox. */
export function TableSurface({ detailed = false }: TableSurfaceProps) {
  const outer = TABLE_LENGTH + 2 * RAIL_BAND;
  return (
    <>
      <rect x={-RAIL_BAND} y={-RAIL_BAND} width={outer} height={TABLE_WIDTH + 2 * RAIL_BAND} rx="0.24" fill={RAIL} />
      <rect x="-0.12" y="-0.12" width="8.24" height="4.24" fill={CUSHION} />
      <rect x="0" y="0" width={TABLE_LENGTH} height={TABLE_WIDTH} fill={FELT} />
      {detailed && (
        <g data-testid="table-surface-detail">
          <line
            x1={HEAD_STRING_X}
            y1="0"
            x2={HEAD_STRING_X}
            y2={TABLE_WIDTH}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="0.015"
            strokeDasharray="0.06 0.06"
          />
          <circle cx={HEAD_STRING_X} cy="2" r="0.025" fill="rgba(255,255,255,0.3)" />
          <circle cx={FOOT_SPOT.x} cy={FOOT_SPOT.y} r="0.025" fill="rgba(255,255,255,0.3)" />
          <path
            fill={DIAMOND}
            d={[
              ...LONG_RAIL_X.map((x) => diamond(x, -0.285)),
              ...LONG_RAIL_X.map((x) => diamond(x, 4.285)),
              ...SHORT_RAIL_Y.map((y) => diamond(-0.285, y)),
              ...SHORT_RAIL_Y.map((y) => diamond(8.285, y)),
            ].join(" ")}
          />
          {POCKET_HOLES.map((hole) => (
            <circle key={`${hole.cx}-${hole.cy}`} {...hole} fill={POCKET_HOLE} />
          ))}
        </g>
      )}
    </>
  );
}
