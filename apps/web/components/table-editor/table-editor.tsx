"use client";

import { useRef, useState, type PointerEvent } from "react";

import { BallLayer } from "@/components/table-editor/ball-layer";
import { TABLE_VIEW_BOX, TableSurface } from "@/components/table-editor/table-surface";
import { useLayoutHistory } from "@/components/table-editor/use-layout-history";
import type { Layout, Point } from "@/lib/layout";
import { findBall, moveBall, otherBallPositions } from "@/lib/layout-edits";
import { ballRadius, placeBall } from "@/lib/table-geometry";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Snap toggle arrives with the toolbar (build step 6); on by default.
  const isSnapping = true;

  const shown = drag?.draft ?? history.present;
  const radius = ballRadius(shown.table.size_ft);

  function toTablePoint(event: PointerEvent): Point {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
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

  return (
    <svg
      ref={svgRef}
      viewBox={TABLE_VIEW_BOX}
      role="img"
      aria-label={`Pool table layout, ${shown.table.size_ft} ft`}
      data-testid="table-editor"
      data-readonly={readOnly}
      className="block h-auto w-full select-none"
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
      onPointerCancel={readOnly ? undefined : handlePointerCancel}
      onPointerDown={readOnly ? undefined : () => setSelectedId(null)}
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
}
