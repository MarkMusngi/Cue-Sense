import { HEAD_STRING_X, POCKETS, TABLE_LENGTH, TABLE_WIDTH, type PocketName } from "@/lib/layout";

// Everything here is in diamond units; the playing surface is 0..8 by 0..4.
export const RAIL_WIDTH = 0.45;
const CUSHION_WIDTH = 0.12;
const DIAMOND_SIZE = 0.05;
const CORNER_POCKET_RADIUS = 0.22;
const SIDE_POCKET_RADIUS = 0.2;
// Pockets sit back from the cushion noses, which meet at the corners.
const CORNER_POCKET_OFFSET = 0.07;
const SIDE_POCKET_OFFSET = 0.14;

const COLORS = {
  rail: "#5b3a21",
  cushion: "#0f5132",
  felt: "#15803d",
  pocket: "#111827",
  diamond: "#f5f0e1",
  marking: "rgba(255, 255, 255, 0.35)",
};

/** The viewBox: the playing surface plus the rails around it. */
export const TABLE_VIEW_BOX = [
  -RAIL_WIDTH,
  -RAIL_WIDTH,
  TABLE_LENGTH + 2 * RAIL_WIDTH,
  TABLE_WIDTH + 2 * RAIL_WIDTH,
].join(" ");

/** Rails, cushions, felt, diamonds, pockets and table markings. Head rail on the left. */
export function TableSurface() {
  return (
    <g data-testid="table-surface">
      <rect
        x={-RAIL_WIDTH}
        y={-RAIL_WIDTH}
        width={TABLE_LENGTH + 2 * RAIL_WIDTH}
        height={TABLE_WIDTH + 2 * RAIL_WIDTH}
        rx={0.25}
        fill={COLORS.rail}
      />
      <rect
        x={-CUSHION_WIDTH}
        y={-CUSHION_WIDTH}
        width={TABLE_LENGTH + 2 * CUSHION_WIDTH}
        height={TABLE_WIDTH + 2 * CUSHION_WIDTH}
        fill={COLORS.cushion}
      />
      <rect x={0} y={0} width={TABLE_LENGTH} height={TABLE_WIDTH} fill={COLORS.felt} />
      <TableMarkings />
      <Diamonds />
      {(Object.keys(POCKETS) as PocketName[]).map((name) => (
        <Pocket key={name} name={name} />
      ))}
    </g>
  );
}

function TableMarkings() {
  return (
    <g stroke={COLORS.marking} strokeWidth={0.015} fill={COLORS.marking}>
      {/* Head string, head spot and foot spot (docs/architecture.md section 4.2). */}
      <line
        x1={HEAD_STRING_X}
        y1={0}
        x2={HEAD_STRING_X}
        y2={TABLE_WIDTH}
        strokeDasharray="0.06 0.06"
      />
      <circle cx={HEAD_STRING_X} cy={TABLE_WIDTH / 2} r={0.025} stroke="none" />
      <circle cx={6} cy={TABLE_WIDTH / 2} r={0.025} stroke="none" />
    </g>
  );
}

function Diamonds() {
  const railCentre = (RAIL_WIDTH + CUSHION_WIDTH) / 2;
  const positions = [
    // Long rails: every diamond but the one at the side pocket.
    ...[1, 2, 3, 5, 6, 7].flatMap((x) => [
      { x, y: -railCentre },
      { x, y: TABLE_WIDTH + railCentre },
    ]),
    // Short rails.
    ...[1, 2, 3].flatMap((y) => [
      { x: -railCentre, y },
      { x: TABLE_LENGTH + railCentre, y },
    ]),
  ];
  return (
    <g fill={COLORS.diamond}>
      {positions.map(({ x, y }) => (
        <rect
          key={`${x},${y}`}
          x={x - DIAMOND_SIZE / 2}
          y={y - DIAMOND_SIZE / 2}
          width={DIAMOND_SIZE}
          height={DIAMOND_SIZE}
          transform={`rotate(45 ${x} ${y})`}
        />
      ))}
    </g>
  );
}

function Pocket({ name }: { name: PocketName }) {
  const { x, y } = POCKETS[name];
  const isSide = name.endsWith("middle");
  const offset = isSide ? SIDE_POCKET_OFFSET : CORNER_POCKET_OFFSET;
  const cx = isSide ? x : x === 0 ? -offset : x + offset;
  const cy = y === 0 ? -offset : y + offset;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSide ? SIDE_POCKET_RADIUS : CORNER_POCKET_RADIUS}
      fill={COLORS.pocket}
      data-testid={`pocket-${name}`}
    >
      {/* One string child: split text nodes in an SVG title break hydration. */}
      <title>{`${name.replace("_", " ")} pocket`}</title>
    </circle>
  );
}
