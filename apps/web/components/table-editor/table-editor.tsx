"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import {
  AnnotationLayer,
  type AnnotationPart,
  type PendingPath,
} from "@/components/table-editor/annotation-layer";
import { BallLayer } from "@/components/table-editor/ball-layer";
import {
  EditorToolbar,
  type EditorTool,
  type ToolbarAction,
} from "@/components/table-editor/editor-toolbar";
import { InspectorRow } from "@/components/table-editor/inspector-row";
import { TABLE_VIEW_BOX, TableSurface } from "@/components/table-editor/table-surface";
import { TargetLayer, type TargetPart } from "@/components/table-editor/target-layer";
import { useLayoutHistory } from "@/components/table-editor/use-layout-history";
import {
  addPathAnnotation,
  addTextAnnotation,
  canAddAnnotation,
  findAnnotation,
  moveAnnotation,
  moveAnnotationPoint,
  removeAnnotation,
  setAnnotationText,
} from "@/lib/annotation-edits";
import {
  CUE_BALL_ID,
  HEAD_STRING_X,
  MAX_OBJECT_BALLS,
  SNAP_STEP,
  type Layout,
  type Point,
} from "@/lib/layout";
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
  canMirrorHorizontal,
  clampToCushions,
  clampToTable,
  mirrorHorizontal,
  mirrorVertical,
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
  // Balls, zones and annotations move; a zone handle resizes; a path point moves alone.
  kind: "ball" | "zone" | "resize" | "annotation" | "point";
  id: string;
  // The point index, for kind "point".
  index: number;
  // Element anchor minus pointer, so the element does not jump under the pointer.
  offset: Point;
  // Pointer and layout when the drag started; annotations move relative to them.
  origin: Point;
  base: Layout;
  // The layout as the drag shows it; committed once on pointer up.
  draft: Layout;
};

// Clicking within this distance of the last point (diamonds) finishes a path.
const FINISH_DISTANCE = 0.08;

const NUDGE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
const FINE_NUDGE = 0.01;

/** The cue ball in hand behind the head string must stay at x <= 2 (section 4.3). */
function headStringLimit(layout: Layout, ballId: string): number | undefined {
  return ballId === layout.cue_ball.id && layout.cue_ball.ball_in_hand === "behind_head_string"
    ? HEAD_STRING_X
    : undefined;
}

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
  const [pending, setPending] = useState<PendingPath | null>(null);
  const [isSnapping, setIsSnapping] = useState(true);

  const present = history.present;
  const shown = drag?.draft ?? present;
  const radius = ballRadius(shown.table.size_ft);
  const selectedBall = selectedId ? findBall(present, selectedId) : undefined;
  const selectedTarget = selectedId ? findTarget(present, selectedId) : undefined;
  const selectedAnnotation = selectedId ? findAnnotation(present, selectedId) : undefined;
  const canAddBall = present.object_balls.length < MAX_OBJECT_BALLS;
  const canDelete =
    selectedTarget !== undefined ||
    selectedAnnotation !== undefined ||
    (selectedBall !== undefined && selectedId !== CUE_BALL_ID);

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

  function isPrimary(event: PointerEvent): boolean {
    return event.pointerType !== "mouse" || event.button === 0;
  }

  function startDrag(
    event: PointerEvent,
    kind: Drag["kind"],
    id: string,
    anchor: Point,
    index = 0,
  ) {
    event.stopPropagation();
    // One pointer at a time: a second finger does not start another drag.
    if (drag) {
      return;
    }
    focusTable();
    try {
      // Keep receiving moves when the pointer leaves the table mid-drag.
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; pointerup or cancel ends the drag anyway.
    }
    const pointer = toTablePoint(event);
    // Read after focusTable: blurring an inspector input may have just saved an edit.
    const latest = history.getPresent();
    setSelectedId(id);
    setDrag({
      pointerId: event.pointerId,
      kind,
      id,
      index,
      offset: { x: anchor.x - pointer.x, y: anchor.y - pointer.y },
      origin: pointer,
      base: latest,
      draft: latest,
    });
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

  function handleAnnotationPointerDown(
    event: PointerEvent<SVGElement>,
    id: string,
    part: AnnotationPart,
  ) {
    if (!isPrimary(event)) {
      return;
    }
    if (part.kind === "point") {
      startDrag(event, "point", id, { x: 0, y: 0 }, part.index);
    } else {
      startDrag(event, "annotation", id, { x: 0, y: 0 });
    }
  }

  function handleTablePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (drag || !isPrimary(event)) {
      return;
    }
    focusTable();
    const point = toTablePoint(event);
    switch (tool) {
      case "ball":
        addBallAt(point);
        break;
      case "pocket_target": {
        const pocket = nearestPocket(point);
        if (pocket) {
          const linked = selectedBall && selectedId !== CUE_BALL_ID ? selectedBall.id : undefined;
          commitNew((latest) => addPocketTarget(latest, pocket, linked), "target");
        }
        break;
      }
      case "circle_zone":
      case "rect_zone": {
        const shape = tool === "circle_zone" ? "circle" : "rect";
        commitNew((latest) => addZone(latest, shape, snap(point)), "target");
        break;
      }
      case "arrow":
      case "line":
        addPathPoint(tool, clampToTable(snap(point)));
        break;
      case "text":
        // Keep the browser from moving focus back to the table after this pointerdown,
        // so the new note's text box keeps focus and typing replaces "Note".
        event.preventDefault();
        commitNew((latest) => addTextAnnotation(latest, snap(point)), "annotation");
        break;
      default:
        setSelectedId(null);
    }
  }

  /** Commit a layout that gained one target or annotation, select it, and go back to Select. */
  function commitNew(add: (latest: Layout) => Layout, kind: "target" | "annotation") {
    const latest = history.getPresent();
    const next = add(latest);
    if (next === latest) {
      return;
    }
    history.commit(next);
    const list = kind === "target" ? next.targets : next.annotations;
    setSelectedId(list[list.length - 1].id);
    setTool("select");
  }

  function addPathPoint(kind: "arrow" | "line", point: Point) {
    if (!pending) {
      setSelectedId(null);
      setPending({ kind, points: [point], hover: null });
      return;
    }
    const last = pending.points[pending.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < FINISH_DISTANCE) {
      finishPath();
    } else {
      setPending({ ...pending, points: [...pending.points, point] });
    }
  }

  function finishPath() {
    if (pending && pending.points.length >= 2) {
      const { kind, points } = pending;
      commitNew((latest) => addPathAnnotation(latest, kind, points), "annotation");
    }
    setPending(null);
  }

  function addBallAt(point: Point) {
    const latest = history.getPresent();
    const others = otherBallPositions(latest, "");
    const placed = placeBall(point, others, radius, {
      isSnapping,
      fallback: clampToCushions(point, radius),
    });
    // No room here: placing would overlap a ball that could not be pushed aside.
    if (others.some((other) => ballsOverlap(placed, other, radius))) {
      return;
    }
    const next = addObjectBall(latest, placed);
    if (next !== latest) {
      history.commit(next);
      setSelectedId(next.object_balls[next.object_balls.length - 1].id);
    }
  }

  function deleteSelected() {
    if (!canDelete || !selectedId) {
      return;
    }
    const id = selectedId;
    history.commit((latest) =>
      selectedTarget
        ? removeTarget(latest, id)
        : selectedAnnotation
          ? removeAnnotation(latest, id)
          : removeBall(latest, id),
    );
    setSelectedId(null);
  }

  /** Move the selection by a small step: arrow keys, for keyboard users. */
  function nudgeSelected(dx: number, dy: number) {
    const id = selectedId;
    if (!id) {
      return;
    }
    history.commit((latest) => {
      const ball = findBall(latest, id);
      if (ball) {
        const placed = placeBall({ x: ball.x + dx, y: ball.y + dy }, otherBallPositions(latest, id), radius, {
          isSnapping: false,
          fallback: { x: ball.x, y: ball.y },
          maxX: headStringLimit(latest, id),
        });
        return moveBall(latest, id, placed);
      }
      const target = findTarget(latest, id);
      if (target?.kind === "zone") {
        return moveZone(latest, id, { x: target.x + dx, y: target.y + dy });
      }
      return findAnnotation(latest, id) ? moveAnnotation(latest, id, { x: dx, y: dy }) : latest;
    });
  }

  /** Undo, redo, reset or mirror: drop anything half-drawn, then change the layout. */
  function travel(move: () => void) {
    if (drag) {
      return;
    }
    setPending(null);
    move();
  }

  const actions: ToolbarAction[] = [
    {
      label: "Snap",
      title: `Snap to a ${SNAP_STEP} diamond grid (${isSnapping ? "on" : "off"})`,
      testId: "toggle-snap",
      isPressed: isSnapping,
      onClick: () => setIsSnapping(!isSnapping),
    },
    {
      label: "Undo",
      title: "Undo (Ctrl+Z)",
      testId: "undo",
      isDisabled: !history.canUndo,
      onClick: () => travel(history.undo),
    },
    {
      label: "Redo",
      title: "Redo (Ctrl+Shift+Z or Ctrl+Y)",
      testId: "redo",
      isDisabled: !history.canRedo,
      onClick: () => travel(history.redo),
    },
    {
      label: "Reset",
      title: "Back to the layout as it was loaded (can be undone)",
      testId: "reset",
      isDisabled: !history.canReset,
      onClick: () => travel(history.reset),
    },
    {
      label: "Mirror H",
      title: canMirrorHorizontal(present)
        ? "Mirror left to right (head and foot swap)"
        : "Not available: the cue ball is in hand behind the head string, and mirroring would move it past",
      testId: "mirror-horizontal",
      isDisabled: !canMirrorHorizontal(present),
      onClick: () => travel(() => history.commit(mirrorHorizontal)),
    },
    {
      label: "Mirror V",
      title: "Mirror top to bottom (the long rails swap)",
      testId: "mirror-vertical",
      onClick: () => travel(() => history.commit(mirrorVertical)),
    },
    {
      label: "Delete",
      title: "Delete the selection (Delete key)",
      testId: "delete-selected",
      isDisabled: !canDelete,
      onClick: deleteSelected,
    },
  ];

  function changeTool(next: EditorTool) {
    setPending(null);
    setTool(next);
    focusTable();
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (pending) {
      // Clamped like the saved points, so the preview matches the result.
      setPending({ ...pending, hover: clampToTable(snap(toTablePoint(event))) });
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const pointer = toTablePoint(event);
    setDrag({ ...drag, draft: dragDraft(drag, pointer) });
  }

  function dragDraft(current: Drag, pointer: Point): Layout {
    const moved = { x: pointer.x + current.offset.x, y: pointer.y + current.offset.y };
    switch (current.kind) {
      case "ball": {
        const ball = findBall(current.draft, current.id);
        if (!ball) {
          return current.draft;
        }
        const placed = placeBall(moved, otherBallPositions(current.draft, current.id), radius, {
          isSnapping,
          fallback: { x: ball.x, y: ball.y },
          maxX: headStringLimit(current.draft, current.id),
        });
        return moveBall(current.draft, current.id, placed);
      }
      case "zone":
        return moveZone(current.draft, current.id, snap(moved));
      case "resize":
        return resizeZone(current.draft, current.id, snap(pointer));
      case "annotation": {
        const offset = snap({ x: pointer.x - current.origin.x, y: pointer.y - current.origin.y });
        return moveAnnotation(current.base, current.id, offset);
      }
      case "point":
        return moveAnnotationPoint(current.draft, current.id, current.index, snap(pointer));
    }
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
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      const isRedo = key === "y" || event.shiftKey;
      travel(isRedo ? history.redo : history.undo);
    } else if (event.key in NUDGE_KEYS && selectedId && !pending && !drag) {
      event.preventDefault();
      const [dx, dy] = NUDGE_KEYS[event.key];
      // Shift for a fine step; otherwise one grid step.
      const step = event.shiftKey ? FINE_NUDGE : SNAP_STEP;
      nudgeSelected(dx * step, dy * step);
    } else if (event.key === "Enter" && pending) {
      event.preventDefault();
      finishPath();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape") {
      if (pending) {
        setPending(null);
      } else {
        setTool("select");
        setSelectedId(null);
      }
    }
  }

  // Only the select tool picks targets and annotations; other tools place things on top.
  const isPicking = !readOnly && tool === "select";
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
      // Touch drags move balls instead of scrolling the page.
      style={readOnly ? undefined : { touchAction: "none" }}
      className={[
        "block h-auto w-full select-none rounded-lg outline-none",
        readOnly ? "" : "focus-visible:ring-2 focus-visible:ring-sky-500",
        tool !== "select" && !readOnly ? "cursor-crosshair" : "",
      ].join(" ")}
      onPointerDown={readOnly ? undefined : handleTablePointerDown}
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
      onPointerCancel={readOnly ? undefined : handlePointerCancel}
      onLostPointerCapture={readOnly ? undefined : handlePointerCancel}
      onKeyDown={readOnly ? undefined : handleKeyDown}
    >
      <TableSurface />
      <TargetLayer
        layout={shown}
        selectedId={readOnly ? null : selectedId}
        onTargetPointerDown={isPicking ? handleTargetPointerDown : undefined}
      />
      <AnnotationLayer
        layout={shown}
        selectedId={readOnly ? null : selectedId}
        pending={readOnly ? null : pending}
        onAnnotationPointerDown={isPicking ? handleAnnotationPointerDown : undefined}
      />
      <BallLayer
        layout={shown}
        radius={radius}
        selectedId={readOnly ? null : selectedId}
        // Other tools draw over balls, for example an aim line from the cue ball.
        onBallPointerDown={
          !readOnly && (tool === "select" || tool === "ball") ? handleBallPointerDown : undefined
        }
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
        onToolChange={changeTool}
        canAddBall={canAddBall}
        canAddAnnotation={canAddAnnotation(present)}
        actions={actions}
      />
      <InspectorRow
        layout={present}
        pending={pending}
        selectedTarget={selectedTarget}
        selectedAnnotation={selectedAnnotation}
        onFinishPath={finishPath}
        onCancelPath={() => setPending(null)}
        onTargetBallChange={(ballId) =>
          selectedId && history.commit((latest) => setTargetBall(latest, selectedId, ballId))
        }
        onZoneLabelChange={(label) =>
          selectedId && history.commit((latest) => setZoneLabel(latest, selectedId, label))
        }
        onAnnotationTextChange={(value) =>
          selectedId && history.commit((latest) => setAnnotationText(latest, selectedId, value))
        }
      />
      {table}
    </div>
  );
}
