"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { BallLayer } from "@/components/table-editor/ball-layer";
import { EditorToolbar, type EditorTool } from "@/components/table-editor/editor-toolbar";
import { TABLE_VIEW_BOX, TableSurface } from "@/components/table-editor/table-surface";
import { TargetInspector } from "@/components/table-editor/target-inspector";
import { TargetLayer, type TargetPart } from "@/components/table-editor/target-layer";
import { useLayoutHistory } from "@/components/table-editor/use-layout-history";
import { CUE_BALL_ID, MAX_OBJECT_BALLS, type Layout, type Point } from "@/lib/layout";
import {
  addObjectBall,
  findBall,
  moveBall,
  otherBallPositions,
  removeBall,
} from "@/lib/layout-edits";
import {
  ballRadius,
  ballsOverlap,
  clampToCushions,
  placeBall,
  snapToGrid,
} from "@/lib/table-geometry";
import {
  addPocketTarget,
  addZone,
  findTarget,
  moveZone,
  nearestPocket,
  removeTarget,
  resizeZone,
  setTargetBall,
  setZoneLabel,
} from "@/lib/target-edits";

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
  // A ball or zone moves; a zone handle resizes.
  kind: "ball" | "zone" | "resize";
  id: string;
  // Element anchor minus pointer, so the element does not jump under the pointer.
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

  const present = history.present;
  const shown = drag?.draft ?? present;
  const radius = ballRadius(shown.table.size_ft);
  const selectedTarget = selectedId ? findTarget(present, selectedId) : undefined;
  const selectedBall = selectedId ? findBall(present, selectedId) : undefined;
  const canAddBall = present.object_balls.length < MAX_OBJECT_BALLS;
  const canDelete = selectedTarget !== undefined || (selectedBall !== undefined && selectedId !== CUE_BALL_ID);

  function toTablePoint(event: PointerEvent): Point {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function snap(point: Point): Point {
    return isSnapping ? snapToGrid(point) : point;
  }

  function focusTable() {
    svgRef.current?.focus({ preventScroll: true });
  }

  function startDrag(event: PointerEvent, kind: Drag["kind"], id: string, anchor: Point) {
    event.stopPropagation();
    focusTable();
    svgRef.current?.setPointerCapture(event.pointerId);
    const pointer = toTablePoint(event);
    setSelectedId(id);
    setDrag({
      pointerId: event.pointerId,
      kind,
      id,
      offset: { x: anchor.x - pointer.x, y: anchor.y - pointer.y },
      draft: present,
    });
  }

  function isPrimary(event: PointerEvent): boolean {
    return event.pointerType !== "mouse" || event.button === 0;
  }

  function handleBallPointerDown(event: PointerEvent<SVGGElement>, ballId: string) {
    const ball = findBall(present, ballId);
    if (isPrimary(event) && ball) {
      startDrag(event, "ball", ballId, ball);
    }
  }

  function handleTargetPointerDown(event: PointerEvent<SVGElement>, id: string, part: TargetPart) {
    const target = findTarget(present, id);
    if (!isPrimary(event) || !target) {
      return;
    }
    if (target.kind === "pocket") {
      event.stopPropagation();
      focusTable();
      setSelectedId(id);
    } else if (part === "handle") {
      startDrag(event, "resize", id, { x: 0, y: 0 });
    } else {
      startDrag(event, "zone", id, target);
    }
  }

  function handleTablePointerDown(event: PointerEvent<SVGSVGElement>) {
    focusTable();
    const point = toTablePoint(event);
    if (tool === "ball") {
      addBallAt(point);
    } else if (tool === "pocket_target") {
      const pocket = nearestPocket(point);
      if (pocket) {
        const linked = selectedBall && selectedId !== CUE_BALL_ID ? selectedId ?? undefined : undefined;
        commitAndSelectLastTarget(addPocketTarget(present, pocket, linked));
      }
    } else if (tool === "circle_zone" || tool === "rect_zone") {
      commitAndSelectLastTarget(addZone(present, tool === "circle_zone" ? "circle" : "rect", snap(point)));
    } else {
      setSelectedId(null);
    }
  }

  function commitAndSelectLastTarget(next: Layout) {
    history.commit(next);
    setSelectedId(next.targets[next.targets.length - 1].id);
    // Targets are placed one at a time; go back to selecting so the new one can be adjusted.
    setTool("select");
  }

  function addBallAt(point: Point) {
    const others = otherBallPositions(present, "");
    const placed = placeBall(point, others, radius, {
      isSnapping,
      fallback: clampToCushions(point, radius),
    });
    // No room here: placing would overlap a ball that could not be pushed aside.
    if (others.some((other) => ballsOverlap(placed, other, radius))) {
      return;
    }
    const next = addObjectBall(present, placed);
    if (next !== present) {
      history.commit(next);
      setSelectedId(next.object_balls[next.object_balls.length - 1].id);
    }
  }

  function deleteSelected() {
    if (!canDelete || !selectedId) {
      return;
    }
    history.commit(selectedTarget ? removeTarget(present, selectedId) : removeBall(present, selectedId));
    setSelectedId(null);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const pointer = toTablePoint(event);
    const moved = { x: pointer.x + drag.offset.x, y: pointer.y + drag.offset.y };
    let draft = drag.draft;
    if (drag.kind === "ball") {
      const current = findBall(draft, drag.id);
      if (!current) {
        return;
      }
      const placed = placeBall(moved, otherBallPositions(draft, drag.id), radius, {
        isSnapping,
        fallback: { x: current.x, y: current.y },
      });
      draft = moveBall(draft, drag.id, placed);
    } else if (drag.kind === "zone") {
      draft = moveZone(draft, drag.id, snap(moved));
    } else {
      draft = resizeZone(draft, drag.id, snap(pointer));
    }
    setDrag({ ...drag, draft });
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
        tool !== "select" && !readOnly ? "cursor-crosshair" : "",
      ].join(" ")}
      onPointerDown={readOnly ? undefined : handleTablePointerDown}
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
      onPointerCancel={readOnly ? undefined : handlePointerCancel}
      onKeyDown={readOnly ? undefined : handleKeyDown}
    >
      <TableSurface />
      <TargetLayer
        layout={shown}
        selectedId={readOnly ? null : selectedId}
        // Only the select tool picks targets; other tools place things on top of zones.
        onTargetPointerDown={readOnly || tool !== "select" ? undefined : handleTargetPointerDown}
      />
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
      {/* A fixed-height row, so selecting a target never moves the table under the pointer. */}
      <div className="flex min-h-9 items-center">
        {selectedTarget && selectedId ? (
          <TargetInspector
            layout={present}
            target={selectedTarget}
            onBallChange={(ballId) => history.commit(setTargetBall(present, selectedId, ballId))}
            onLabelChange={(label) => history.commit(setZoneLabel(present, selectedId, label))}
          />
        ) : (
          <p className="text-sm text-neutral-500">
            Select a target to choose its ball or label it.
          </p>
        )}
      </div>
      {table}
    </div>
  );
}
