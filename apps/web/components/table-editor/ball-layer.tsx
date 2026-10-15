import { useId, type PointerEvent } from "react";

import type { CueBall, Layout, ObjectBall } from "@/lib/layout";

// Standard pool colours; 9 to 15 are stripes of 1 to 7.
const BALL_COLORS: Record<number, string> = {
  1: "#facc15",
  2: "#1d4ed8",
  3: "#dc2626",
  4: "#6d28d9",
  5: "#ea580c",
  6: "#064e3b",
  7: "#7f1d1d",
  8: "#111827",
};
const CUE_COLOR = "#f8fafc";
const UNNUMBERED_COLOR = "#a3a3a3";
const OUTLINE = "rgba(0, 0, 0, 0.45)";
const SELECTED = "#38bdf8";

type BallLayerProps = {
  layout: Layout;
  radius: number;
  selectedId: string | null;
  // Absent when read-only.
  onBallPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
};

export function BallLayer({ layout, radius, selectedId, onBallPointerDown }: BallLayerProps) {
  // Unique per editor, so several editors on one page do not share clip paths.
  const clipPrefix = useId();
  const balls: (CueBall | ObjectBall)[] = [layout.cue_ball, ...layout.object_balls];
  return (
    <g data-testid="ball-layer">
      {balls.map((ball) => (
        <Ball
          key={ball.id}
          ball={ball}
          radius={radius}
          clipId={`${clipPrefix}-${ball.id}`}
          isSelected={ball.id === selectedId}
          onPointerDown={onBallPointerDown && ((event) => onBallPointerDown(event, ball.id))}
        />
      ))}
    </g>
  );
}

type BallProps = {
  ball: CueBall | ObjectBall;
  radius: number;
  clipId: string;
  isSelected: boolean;
  onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
};

function Ball({ ball, radius, clipId, isSelected, onPointerDown }: BallProps) {
  const number = "number" in ball ? ball.number : undefined;
  const isCue = "ball_in_hand" in ball;
  const isStripe = number !== undefined && number > 8;
  const color = isCue
    ? CUE_COLOR
    : number === undefined
      ? UNNUMBERED_COLOR
      : BALL_COLORS[isStripe ? number - 8 : number];
  const label = isCue ? "Cue ball" : number === undefined ? "Object ball" : `${number} ball`;
  return (
    <g
      data-testid={`ball-${ball.id}`}
      onPointerDown={onPointerDown}
      className={onPointerDown ? "cursor-grab active:cursor-grabbing" : undefined}
    >
      <title>{label}</title>
      {isStripe ? (
        <>
          <clipPath id={clipId}>
            <circle cx={ball.x} cy={ball.y} r={radius} />
          </clipPath>
          <circle cx={ball.x} cy={ball.y} r={radius} fill={CUE_COLOR} />
          <rect
            x={ball.x - radius}
            y={ball.y - radius * 0.55}
            width={2 * radius}
            height={radius * 1.1}
            fill={color}
            clipPath={`url(#${clipId})`}
          />
          <circle cx={ball.x} cy={ball.y} r={radius} fill="none" stroke={OUTLINE} strokeWidth={0.008} />
        </>
      ) : (
        <circle cx={ball.x} cy={ball.y} r={radius} fill={color} stroke={OUTLINE} strokeWidth={0.008} />
      )}
      {number !== undefined && (
        <>
          <circle cx={ball.x} cy={ball.y} r={radius * 0.48} fill={CUE_COLOR} />
          <text
            x={ball.x}
            y={ball.y}
            fontSize={radius * 0.75}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111827"
          >
            {String(number)}
          </text>
        </>
      )}
      {onPointerDown && (
        // An invisible ring around the ball, so a fingertip can grab it.
        <circle cx={ball.x} cy={ball.y} r={radius * 1.6} fill="transparent" />
      )}
      {isSelected && (
        <circle
          cx={ball.x}
          cy={ball.y}
          r={radius + 0.03}
          fill="none"
          stroke={SELECTED}
          strokeWidth={0.02}
          data-testid="selection-ring"
        />
      )}
    </g>
  );
}
