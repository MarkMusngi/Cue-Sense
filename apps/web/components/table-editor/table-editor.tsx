"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { DrillLayout, PocketName } from "@/lib/api-client";
import { CUE_BALL_ID, FINE_STEP, SNAP_STEP, VIEW_BOX, type Point } from "@/lib/layout";
import {
  addBall,
  allBalls,
  moveBall,
  removeBall,
  setCueSpin,
  setLandingZone,
  togglePocket,
} from "@/lib/layout-edits";
import { canAddBall, nextBallId } from "@/lib/layout-ids";
import {
  ballRadius,
  ballsOverlap,
  clampToTable,
  clientToTable,
  findFreeSpot,
  mirrorHorizontal,
  mirrorVertical,
  placeBall,
  roundToMillis,
  snapToGrid,
} from "@/lib/table-geometry";

import { CueSpinPicker } from "./cue-spin-picker";
import {
  ballTestId,
  describeLayout,
  LANDING_ZONE_ID,
  selectionExists,
  selectionPosition,
  type Tool,
} from "./editor-state";
import { EditorToolbar } from "./editor-toolbar";
import { SelectionBar } from "./selection-bar";
import { TableLayers, type LayerHandlers } from "./table-layers";
import { useLayoutHistory } from "./use-layout-history";

type TableEditorProps = {
  layout: DrillLayout;
  /** Called with the whole new layout after every change, including undo, redo and reset. */
  onChange?: (layout: DrillLayout) => void;
  /** Draw the table only: no toolbar, handlers or focus. */
  readOnly?: boolean;
};

type Drag = {
  pointerId: number;
  id: string;
  offset: Point;
  last: Point;
  draft: DrillLayout | null;
};

const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

const TABLE_CENTRE: Point = { x: 4, y: 2 };

/**
 * The drill layout editor: drag balls and the landing zone, tap a pocket to target it,
 * set the cue spin, undo and redo. Controlled: the layout comes from the parent, which
 * is told about every change. Everything is also reachable from the keyboard.
 */
export function TableEditor({ layout, onChange, readOnly = false }: TableEditorProps) {
  const history = useLayoutHistory(layout, onChange);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [isSnapping, setIsSnapping] = useState(true);
  const [draft, setDraft] = useState<DrillLayout | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const focusAfterRender = useRef<string | null>(null);
  const helpId = useId();
  const radius = ballRadius();

  // After adding something from the keyboard, move focus to it so the arrow keys and
  // Delete act on it straight away. Runs after every render and does nothing otherwise.
  useEffect(() => {
    const testId = focusAfterRender.current;
    if (!testId) return;
    focusAfterRender.current = null;
    rootRef.current?.querySelector<SVGElement>(`[data-testid="${testId}"]`)?.focus();
  });

  const shown = draft ?? history.present;
  const active = selectionExists(shown, selected) ? selected : null;
  const viewBox = `${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`;

  if (readOnly) {
    return (
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={describeLayout(layout)}
        className="block w-full"
        data-testid="table-editor-readonly"
      >
        <TableLayers layout={layout} radius={radius} selected={null} tool="select" />
      </svg>
    );
  }

  function pointerToTable(event: { clientX: number; clientY: number }): Point | null {
    const svg = svgRef.current;
    return svg ? clientToTable(svg.getBoundingClientRect(), event.clientX, event.clientY) : null;
  }

  function otherBalls(base: DrillLayout, exceptId: string | null): Point[] {
    return allBalls(base).filter((ball) => ball.id !== exceptId);
  }

  function snapAndClamp(point: Point): Point {
    const clamped = clampToTable(isSnapping ? snapToGrid(point) : point);
    return { x: roundToMillis(clamped.x), y: roundToMillis(clamped.y) };
  }

  // Pointer drags edit a draft so they render smoothly; one drag is one undo step.
  function startDrag(event: PointerEvent<Element>, id: string) {
    const pointer = pointerToTable(event);
    const from = selectionPosition(history.getPresent(), id);
    if (!pointer || !from) return;
    dragRef.current = {
      pointerId: event.pointerId,
      id,
      offset: { x: pointer.x - from.x, y: pointer.y - from.y },
      last: { x: from.x, y: from.y },
      draft: null,
    };
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; the drag still follows the pointer over the table.
    }
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const pointer = pointerToTable(event);
    if (!drag || drag.pointerId !== event.pointerId || !pointer) return;
    const target = { x: pointer.x - drag.offset.x, y: pointer.y - drag.offset.y };
    const base = history.getPresent();
    if (drag.id === LANDING_ZONE_ID) {
      drag.last = snapAndClamp(target);
      drag.draft = setLandingZone(base, drag.last);
    } else {
      drag.last = placeBall(target, otherBalls(base, drag.id), radius, {
        isSnapping,
        fallback: drag.last,
      });
      drag.draft = moveBall(base, drag.id, drag.last);
    }
    setDraft(drag.draft);
  }

  function endDrag(event: PointerEvent<SVGSVGElement>, shouldCommit: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraft(null);
    if (shouldCommit && drag.draft) history.commit(drag.draft);
  }

  function addBallAt(point: Point) {
    const base = history.getPresent();
    if (!canAddBall(base)) return;
    const balls = allBalls(base);
    const at = placeBall(point, balls, radius, { isSnapping, fallback: point });
    // No clear spot near the pointer: leave the table as it is.
    if (balls.some((ball) => ballsOverlap(at, ball, radius))) return;
    const id = nextBallId(base);
    history.commit(addBall(base, at));
    setSelected(id);
  }

  function placeZoneAt(point: Point) {
    history.commit((present) => setLandingZone(present, snapAndClamp(point)));
    setSelected(LANDING_ZONE_ID);
    setTool("select");
  }

  function onBackgroundPointerDown(event: PointerEvent<SVGSVGElement>) {
    const point = pointerToTable(event);
    if (!point) return;
    if (tool === "ball") addBallAt(point);
    else if (tool === "zone") placeZoneAt(point);
    else setSelected(null);
  }

  function nudge(id: string, direction: Point, step: number) {
    const base = history.getPresent();
    const from = selectionPosition(base, id);
    if (!from) return;
    const target = { x: from.x + direction.x * step, y: from.y + direction.y * step };
    if (id === LANDING_ZONE_ID) {
      history.commit(setLandingZone(base, clampToTable(target)));
    } else {
      const to = placeBall(target, otherBalls(base, id), radius, { isSnapping: false, fallback: from });
      history.commit(moveBall(base, id, to));
    }
  }

  function removeSelected(id: string) {
    if (id === CUE_BALL_ID) return;
    history.commit((present) =>
      id === LANDING_ZONE_ID ? setLandingZone(present, null) : removeBall(present, id),
    );
    setSelected(null);
    // The removed element held focus; keep keyboard users in the editor.
    rootRef.current?.focus();
  }

  // Keys on a focused ball or the landing zone: select, nudge, delete, deselect.
  function onElementKeyDown(event: KeyboardEvent<Element>, id: string) {
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(id);
    } else if (event.key in ARROWS) {
      event.preventDefault();
      setSelected(id);
      nudge(id, ARROWS[event.key], event.shiftKey ? FINE_STEP : SNAP_STEP);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected(id);
    } else {
      return;
    }
    event.stopPropagation();
  }

  const handlers: LayerHandlers = {
    onBallPointerDown(event, id) {
      if (tool === "pocket" || tool === "zone") return;
      event.stopPropagation();
      setSelected(id);
      startDrag(event, id);
    },
    onBallKeyDown: (event, id) => onElementKeyDown(event, id),
    onZonePointerDown(event) {
      if (tool === "zone" || tool === "pocket") return;
      event.stopPropagation();
      setSelected(LANDING_ZONE_ID);
      startDrag(event, LANDING_ZONE_ID);
    },
    onZoneKeyDown: (event) => onElementKeyDown(event, LANDING_ZONE_ID),
    onPocketPointerDown(event, pocket: PocketName) {
      if (tool !== "pocket") return;
      event.stopPropagation();
      history.commit((present) => togglePocket(present, pocket));
    },
    onPocketKeyDown(event, pocket: PocketName) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      history.commit((present) => togglePocket(present, pocket));
    },
    onPlaceKeyDown(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      if (tool === "zone") {
        focusAfterRender.current = "table-editor-landing-zone";
        placeZoneAt(TABLE_CENTRE);
        return;
      }
      const base = history.getPresent();
      const spot = canAddBall(base) ? findFreeSpot(allBalls(base), radius) : null;
      if (!spot) return;
      const id = nextBallId(base);
      focusAfterRender.current = `table-editor-ball-${ballTestId(id)}`;
      history.commit(addBall(base, spot));
      setSelected(id);
    },
  };

  function onRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const isModified = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (isModified && key === "z") {
      event.preventDefault();
      if (event.shiftKey) history.redo();
      else history.undo();
    } else if (isModified && key === "y") {
      event.preventDefault();
      history.redo();
    } else if (event.key === "Escape") {
      if (tool !== "select") setTool("select");
      else setSelected(null);
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      style={{ outline: "none" }}
      className="flex flex-col gap-3"
      data-testid="table-editor"
      onKeyDown={onRootKeyDown}
    >
      <EditorToolbar
        tool={tool}
        onToolChange={setTool}
        isSnapping={isSnapping}
        onSnapChange={setIsSnapping}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canReset={history.canReset}
        onUndo={history.undo}
        onRedo={history.redo}
        onReset={history.reset}
        onMirrorHorizontal={() => history.commit((present) => mirrorHorizontal(present))}
        onMirrorVertical={() => history.commit((present) => mirrorVertical(present))}
      />
      <SelectionBar
        layout={shown}
        selected={active}
        onDelete={() => active && removeSelected(active)}
      />
      <div className="overflow-hidden rounded-[14px] border border-line">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          role="group"
          aria-label={describeLayout(shown)}
          aria-describedby={helpId}
          className="block w-full touch-none select-none"
          data-testid="table-editor-svg"
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => endDrag(event, true)}
          onPointerCancel={(event) => endDrag(event, false)}
        >
          <TableLayers layout={shown} radius={radius} selected={active} tool={tool} handlers={handlers} />
        </svg>
      </div>
      <p id={helpId} className="sr-only">
        Tab to a ball, the landing zone or a pocket. Press Enter to select or choose it. Arrow keys
        nudge the selection by 0.05, or 0.01 with Shift. Delete removes it. Escape clears the
        selection or the tool. Control or Command with Z undoes.
      </p>
      <CueSpinPicker
        spin={shown.cue_spin ?? null}
        onChange={(spin) => history.commit((present) => setCueSpin(present, spin))}
      />
    </div>
  );
}
