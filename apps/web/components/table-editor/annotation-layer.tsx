import { useId, type PointerEvent } from "react";

import type { Annotation, Layout, Point } from "@/lib/layout";

const STROKE = "#f8fafc";
const SELECTED = "#38bdf8";
const STROKE_WIDTH = 0.03;
const HANDLE_RADIUS = 0.06;
const TEXT_SIZE = 0.16;
const LABEL_SIZE = 0.13;
// Dark halo behind white text so it reads on felt and on zones.
const HALO = { stroke: "rgba(0, 0, 0, 0.6)", strokeWidth: 0.03, paintOrder: "stroke" } as const;

export type AnnotationPart = { kind: "body" } | { kind: "point"; index: number };

/** An arrow or line still being drawn, with the pointer as its next point. */
export type PendingPath = { kind: "arrow" | "line"; points: Point[]; hover: Point | null };

type AnnotationLayerProps = {
  layout: Layout;
  selectedId: string | null;
  pending: PendingPath | null;
  // Absent when annotations should not react (read-only, or another tool is active).
  onAnnotationPointerDown?: (
    event: PointerEvent<SVGElement>,
    id: string,
    part: AnnotationPart,
  ) => void;
};

export function AnnotationLayer({
  layout,
  selectedId,
  pending,
  onAnnotationPointerDown,
}: AnnotationLayerProps) {
  // Unique per editor, so several editors on one page do not share markers.
  const markerPrefix = useId();
  const markers = { normal: `${markerPrefix}-arrow`, selected: `${markerPrefix}-arrow-selected` };
  return (
    <g data-testid="annotation-layer">
      <defs>
        <ArrowMarker id={markers.normal} color={STROKE} />
        <ArrowMarker id={markers.selected} color={SELECTED} />
      </defs>
      {layout.annotations.map((annotation) => (
        <AnnotationShape
          key={annotation.id}
          annotation={annotation}
          isSelected={annotation.id === selectedId}
          markers={markers}
          onPointerDown={
            onAnnotationPointerDown &&
            ((event, part) => onAnnotationPointerDown(event, annotation.id, part))
          }
        />
      ))}
      {pending && <PendingPathShape pending={pending} marker={markers.selected} />}
    </g>
  );
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      markerWidth={4}
      markerHeight={4}
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );
}

type AnnotationShapeProps = {
  annotation: Annotation;
  isSelected: boolean;
  markers: { normal: string; selected: string };
  onPointerDown?: (event: PointerEvent<SVGElement>, part: AnnotationPart) => void;
};

function AnnotationShape({ annotation, isSelected, markers, onPointerDown }: AnnotationShapeProps) {
  const color = isSelected ? SELECTED : STROKE;
  const onBody = onPointerDown && ((event: PointerEvent<SVGElement>) => onPointerDown(event, { kind: "body" }));
  const bodyClass = onPointerDown ? "cursor-move" : undefined;

  if (annotation.kind === "text") {
    return (
      <text
        x={annotation.x}
        y={annotation.y}
        fontSize={TEXT_SIZE}
        fill={color}
        dominantBaseline="middle"
        {...HALO}
        onPointerDown={onBody}
        className={bodyClass}
        data-testid={`annotation-${annotation.id}`}
      >
        {annotation.text}
      </text>
    );
  }

  const points = annotation.points.map((p) => `${p.x},${p.y}`).join(" ");
  const [first, second] = annotation.points;
  return (
    <g data-testid={`annotation-${annotation.id}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={annotation.kind === "line" ? "0.1 0.06" : undefined}
        markerEnd={
          annotation.kind === "arrow"
            ? `url(#${isSelected ? markers.selected : markers.normal})`
            : undefined
        }
        pointerEvents="none"
      />
      {/* A wide invisible copy so a thin line is easy to hit. */}
      <polyline
        points={points}
        fill="none"
        stroke="transparent"
        strokeWidth={0.15}
        onPointerDown={onBody}
        className={bodyClass}
      />
      {annotation.label && (
        <text
          x={(first.x + second.x) / 2}
          y={(first.y + second.y) / 2 - 0.08}
          fontSize={LABEL_SIZE}
          fill={color}
          textAnchor="middle"
          {...HALO}
          pointerEvents="none"
        >
          {annotation.label}
        </text>
      )}
      {isSelected &&
        onPointerDown &&
        annotation.points.map((p, index) => (
          <circle
            key={index}
            cx={p.x}
            cy={p.y}
            r={HANDLE_RADIUS}
            fill={SELECTED}
            stroke="#0c4a6e"
            strokeWidth={0.015}
            className="cursor-crosshair"
            data-testid={`point-${annotation.id}-${index}`}
            onPointerDown={(event) => onPointerDown(event, { kind: "point", index })}
          />
        ))}
    </g>
  );
}

function PendingPathShape({ pending, marker }: { pending: PendingPath; marker: string }) {
  const points = pending.hover ? [...pending.points, pending.hover] : pending.points;
  return (
    <g pointerEvents="none" data-testid="pending-path">
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={SELECTED}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={pending.kind === "line" ? "0.1 0.06" : undefined}
        markerEnd={pending.kind === "arrow" && points.length > 1 ? `url(#${marker})` : undefined}
      />
      {pending.points.map((p, index) => (
        <circle key={index} cx={p.x} cy={p.y} r={HANDLE_RADIUS * 0.7} fill={SELECTED} />
      ))}
    </g>
  );
}
