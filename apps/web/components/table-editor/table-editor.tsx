"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { BallLayer } from "@/components/table-editor/ball-layer";
import { EditorToolbar, type EditorTool } from "@/components/table-editor/editor-toolbar";
import { TABLE_VIEW_BOX, TableSurface } from "@/components/table-editor/table-surface";
import { useLayoutHistory } from "@/components/table-editor/use-layout-history";
import { CUE_BALL_ID, MAX_OBJECT_BALLS, type Layout, type Point } from "@/lib/layout";
import {
  addObjectBall,
  findBall,
  moveBall,
  otherBallPositions,
  removeBall,
} from "@/lib/layout-edits";
import { ballRadius, ballsOverlap, clampToCushions, placeBall } from "@/lib/table-geometry";

export type TableEditorProps = {
  /**
   * The layout to show. The editor never mutates it. Keep the same object between
   * renders unless the layout really changed: a different object replaces the history.
   */
  layout: Layout;
  /** Called with a whole new layout after each edit. Not needed when readOnly. */
  onChange?: (layout: Layout) => void;
  /** Render only: no handlers, toolbar or focus. Used for thumbnails and viewers. */
  readOnly?: boolean;
};

type Drag = {
  pointerId: number;
  ballId: string;
  // Ball centre minus pointer, so the ball does not jump under the pointer.
  offset: Point;
  // The layout as the drag shows it; committed once on pointer up.
  draft: Layout;
};

/**
 * SVG table layout editor in diamond units (docs/architecture.md section 4.8).
 * Controlled: the parent owns the layout. See docs/table-editor.md for the design.
 */
export function TableEditor({ layout, onChange, readOnly = false }: TableEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useLayoutHistory(layout, onChange);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Snap toggle arrives with the toolbar (build step 6); on by default.
  const isSnapping = true;

  const shown = drag?.draft ?? history.present;
  const radius = ballRadius(shown.table.size_ft);
  const canAddBall = history.present.object_balls.length < MAX_OBJECT_BALLS;
  const canDelete =
    selectedId !== null &&
    selectedId !== CUE_BALL_ID &&
    findBall(history.present, selectedId) !== undefined;

  function toTablePoint(event: PointerEvent): Point {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function focusTable() {
    svgRef.current?.focus({ preventScroll: true });
  }

  function handleBallPointerDown(event: PointerEvent<SVGGElement>, ballId: string) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const ball = findBall(history.present, ballId);
    if (!ball) {
      return;
    }
    event.stopPropagation();
    focusTable();
    svgRef.current?.setPointerCapture(event.pointerId);
    const pointer = toTablePoint(event);
    setSelectedId(ballId);
    setDrag({
      pointerId: event.pointerId,
      ballId,
      offset: { x: ball.x - pointer.x, y: ball.y - pointer.y },
      draft: history.present,
    });
  }

  function handleTablePointerDown(event: PointerEvent<SVGSVGElement>) {
    focusTable();
    if (tool === "ball") {
      addBallAt(toTablePoint(event));
    } else {
      setSelectedId(null);
    }
  }

  function addBallAt(point: Point) {
    const others = otherBallPositions(history.present, "");
    const placed = placeBall(point, others, radius, {
      isSnapping,
      fallback: clampToCushions(point, radius),
    });
    // No room here: placing would overlap a ball that could not be pushed aside.
    if (others.some((other) => ballsOverlap(placed, other, radius))) {
      return;
    }
    const next = addObjectBall(history.present, placed);
    if (next !== history.present) {
      history.commit(next);
      setSelectedId(next.object_balls[next.object_balls.length - 1].id);
    }
  }

  function deleteSelected() {
    if (canDelete && selectedId) {
      history.commit(removeBall(history.present, selectedId));
      setSelectedId(null);
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const pointer = toTablePoint(event);
    const current = findBall(drag.draft, drag.ballId);
    if (!current) {
      return;
    }
    const placed = placeBall(
      { x: pointer.x + drag.offset.x, y: pointer.y + drag.offset.y },
      otherBallPositions(drag.draft, drag.ballId),
      radius,
      { isSnapping, fallback: { x: current.x, y: current.y } },
    );
    setDrag({ ...drag, draft: moveBall(drag.draft, drag.ballId, placed) });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    history.commit(drag.draft);
    setDrag(null);
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    if (drag && event.pointerId === drag.pointerId) {
      // The gesture was interrupted (for example by a scroll): drop the draft.
      setDrag(null);
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape") {
      setTool("select");
      setSelectedId(null);
    }
  }

  const table = (
    <svg
      ref={svgRef}
      viewBox={TABLE_VIEW_BOX}
      role={readOnly ? "img" : "application"}
      aria-label={`Pool table layout, ${shown.table.size_ft} ft`}
      aria-roledescription={readOnly ? undefined : "table layout editor"}
      tabIndex={readOnly ? undefined : 0}
      data-testid="table-editor"
      data-readonly={readOnly}
      className={[
        "block h-auto w-full select-none rounded-lg outline-none",
        readOnly ? "" : "focus-visible:ring-2 focus-visible:ring-sky-500",
        tool === "ball" && !readOnly ? "cursor-crosshair" : "",
      ].join(" ")}
      onPointerDown={readOnly ? undefined : handleTablePointerDown}
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
      onPointerCancel={readOnly ? undefined : handlePointerCancel}
      onKeyDown={readOnly ? undefined : handleKeyDown}
    >
      <TableSurface />
      <BallLayer
        layout={shown}
        radius={radius}
        selectedId={readOnly ? null : selectedId}
        onBallPointerDown={readOnly ? undefined : handleBallPointerDown}
      />
    </svg>
  );

  if (readOnly) {
    return table;
  }
  return (
    <div className="flex flex-col gap-2">
      <EditorToolbar
        tool={tool}
        onToolChange={(next) => {
          setTool(next);
          focusTable();
        }}
        canAddBall={canAddBall}
        canDelete={canDelete}
        onDelete={deleteSelected}
      />
      {table}
    </div>
  );
}
