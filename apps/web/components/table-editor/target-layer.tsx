import type { PointerEvent } from "react";

import { pocketCentre } from "@/components/table-editor/table-surface";
import type { Layout, ObjectBall, Target } from "@/lib/layout";

const ZONE_FILL = "rgba(251, 191, 36, 0.22)";
const TARGET_STROKE = "#fbbf24";
const SELECTED = "#38bdf8";
const HANDLE_SIZE = 0.12;
const LABEL_SIZE = 0.14;

export type TargetPart = "body" | "handle";

type TargetLayerProps = {
  layout: Layout;
  selectedId: string | null;
  // Absent when targets should not react (read-only, or another tool is active).
  onTargetPointerDown?: (event: PointerEvent<SVGElement>, id: string, part: TargetPart) => void;
};

export function TargetLayer({ layout, selectedId, onTargetPointerDown }: TargetLayerProps) {
  // Several targets on one pocket get rings of growing size so each stays visible.
  const ringIndex = new Map<string, number>();
  const seenPerPocket = new Map<string, number>();
  for (const target of layout.targets) {
    if (target.kind === "pocket") {
      const index = seenPerPocket.get(target.pocket) ?? 0;
      ringIndex.set(target.id, index);
      seenPerPocket.set(target.pocket, index + 1);
    }
  }
  return (
    <g data-testid="target-layer">
      {layout.targets.map((target) => (
        <TargetShape
          key={target.id}
          target={target}
          ballLabel={ballLabel(layout, target.ball_id)}
          ringIndex={ringIndex.get(target.id) ?? 0}
          isSelected={target.id === selectedId}
          onPointerDown={
            onTargetPointerDown &&
            ((event, part) => onTargetPointerDown(event, target.id, part))
          }
        />
      ))}
    </g>
  );
}

type TargetShapeProps = {
  target: Target;
  ballLabel: string;
  ringIndex: number;
  isSelected: boolean;
  onPointerDown?: (event: PointerEvent<SVGElement>, part: TargetPart) => void;
};

function TargetShape({ target, ballLabel, ringIndex, isSelected, onPointerDown }: TargetShapeProps) {
  const stroke = isSelected ? SELECTED : TARGET_STROKE;
  const interactive = onPointerDown ? "cursor-pointer" : undefined;
  const handleBody = onPointerDown && ((event: PointerEvent<SVGElement>) => onPointerDown(event, "body"));

  if (target.kind === "pocket") {
    const centre = pocketCentre(target.pocket);
    const radius = 0.3 + ringIndex * 0.08;
    return (
      <g data-testid={`target-${target.id}`} onPointerDown={handleBody} className={interactive}>
        <title>{`Pocket target: ${ballLabel} in ${target.pocket.replace("_", " ")}`}</title>
        <circle
          cx={centre.x}
          cy={centre.y}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={0.035}
          strokeDasharray="0.08 0.05"
        />
        {/* A wide invisible ring so the dashed one is easy to hit. */}
        <circle cx={centre.x} cy={centre.y} r={radius} fill="none" stroke="transparent" strokeWidth={0.15} />
      </g>
    );
  }

  const isCircle = target.shape === "circle";
  const handle = isCircle
    ? { x: target.x + target.radius, y: target.y }
    : { x: target.x + target.width, y: target.y + target.height };
  const labelAt = isCircle
    ? { x: target.x, y: target.y - target.radius - 0.06 }
    : { x: target.x + 0.06, y: target.y + LABEL_SIZE + 0.04 };
  const label = [target.label, target.ball_id ? ballLabel : undefined].filter(Boolean).join(" · ");
  return (
    <g data-testid={`target-${target.id}`}>
      <title>{`Zone: ${target.label ?? "unlabelled"}, ${ballLabel}`}</title>
      {isCircle ? (
        <circle
          cx={target.x}
          cy={target.y}
          r={target.radius}
          fill={ZONE_FILL}
          stroke={stroke}
          strokeWidth={0.025}
          strokeDasharray="0.08 0.05"
          onPointerDown={handleBody}
          className={interactive ? "cursor-move" : undefined}
        />
      ) : (
        <rect
          x={target.x}
          y={target.y}
          width={target.width}
          height={target.height}
          fill={ZONE_FILL}
          stroke={stroke}
          strokeWidth={0.025}
          strokeDasharray="0.08 0.05"
          onPointerDown={handleBody}
          className={interactive ? "cursor-move" : undefined}
        />
      )}
      {label && (
        <text
          x={labelAt.x}
          y={labelAt.y}
          fontSize={LABEL_SIZE}
          fill="#fef3c7"
          textAnchor={isCircle ? "middle" : "start"}
          pointerEvents="none"
        >
          {label}
        </text>
      )}
      {isSelected && onPointerDown && (
        <rect
          x={handle.x - HANDLE_SIZE / 2}
          y={handle.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill={SELECTED}
          stroke="#0c4a6e"
          strokeWidth={0.015}
          className="cursor-nwse-resize"
          data-testid={`resize-${target.id}`}
          onPointerDown={(event) => onPointerDown(event, "handle")}
        />
      )}
    </g>
  );
}

function ballLabel(layout: Layout, ballId: string | undefined): string {
  if (ballId === undefined) {
    return "any ball";
  }
  if (ballId === layout.cue_ball.id) {
    return "cue ball";
  }
  const ball: ObjectBall | undefined = layout.object_balls.find((b) => b.id === ballId);
  return ball?.number !== undefined ? `${ball.number} ball` : ballId;
}
