"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { clampSpin, describeSpin, type Spin } from "@/lib/cue-spin";
import { FINE_STEP, SNAP_STEP } from "@/lib/layout";
import { roundToMillis } from "@/lib/table-geometry";

import { Button } from "../ui/button";
import { CueSpin } from "../ui/cue-spin";

// CueSpin draws a hit point of 1 at 0.82 of the ball's radius, inside a 2.5 unit view.
const VIEW_SIZE = 2.5;
const DOT_REACH = 0.82;
const SIZE = 96;

type CueSpinPickerProps = {
  /** The layout's cue_spin; null when none is set. */
  spin: Spin | null;
  /** Called once per gesture (pointer up, or one key press) with the new spin, or null to clear. */
  onChange: (spin: Spin | null) => void;
};

function spinFromPointer(element: HTMLElement, clientX: number, clientY: number): Spin | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (((clientX - rect.left) / rect.width - 0.5) * VIEW_SIZE) / DOT_REACH;
  const y = (-((clientY - rect.top) / rect.height - 0.5) * VIEW_SIZE) / DOT_REACH;
  const clamped = clampSpin({ x, y });
  return { x: roundToMillis(clamped.x), y: roundToMillis(clamped.y) };
}

/** The cue ball face with a draggable hit point. Also works with the arrow keys. */
export function CueSpinPicker({ spin, onChange }: CueSpinPickerProps) {
  const [draft, setDraft] = useState<Spin | null>(null);
  const draftRef = useRef<Spin | null>(null);
  const pointerId = useRef<number | null>(null);
  const shown = draft ?? spin;

  function updateDraft(next: Spin | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const next = spinFromPointer(event.currentTarget, event.clientX, event.clientY);
    if (!next) return;
    pointerId.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every environment supports capture; the drag still works inside the face.
    }
    updateDraft(next);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return;
    const next = spinFromPointer(event.currentTarget, event.clientX, event.clientY);
    if (next) updateDraft(next);
  }

  function finish(event: PointerEvent<HTMLDivElement>, shouldCommit: boolean) {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    const final = draftRef.current;
    updateDraft(null);
    if (shouldCommit && final) onChange(final);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? FINE_STEP : SNAP_STEP;
    const current = spin ?? { x: 0, y: 0 };
    const moves: Record<string, Spin> = {
      ArrowLeft: { x: current.x - step, y: current.y },
      ArrowRight: { x: current.x + step, y: current.y },
      ArrowUp: { x: current.x, y: current.y + step },
      ArrowDown: { x: current.x, y: current.y - step },
    };
    if (event.key in moves) {
      event.preventDefault();
      const next = clampSpin(moves[event.key]);
      onChange({ x: roundToMillis(next.x), y: roundToMillis(next.y) });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onChange(null);
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-2.5"
      data-testid="table-editor-spin-panel"
    >
      <div
        role="group"
        tabIndex={0}
        aria-label="Cue spin hit point"
        aria-describedby="table-editor-spin-text"
        data-testid="table-editor-spin"
        className="touch-none shrink-0 cursor-crosshair rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onKeyDown={onKeyDown}
      >
        <CueSpin spin={shown ?? undefined} size={SIZE} className="pointer-events-none" />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 text-sm">
        <span className="font-semibold">Cue spin</span>
        <span id="table-editor-spin-text" className="text-muted" data-testid="table-editor-spin-text">
          {shown ? describeSpin(shown) : "Not set (center ball)"}
        </span>
        <Button
          variant="ghost"
          className="-ml-3"
          disabled={spin === null}
          data-testid="table-editor-spin-clear"
          onClick={() => onChange(null)}
        >
          Clear spin
        </Button>
      </div>
    </div>
  );
}
