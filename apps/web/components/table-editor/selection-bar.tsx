"use client";

import type { DrillLayout } from "@/lib/api-client";
import { ballColor } from "@/lib/ball-colors";
import { CUE_BALL_ID } from "@/lib/layout";

import { Button } from "../ui/button";
import { LANDING_ZONE_ID, selectionLabel, selectionPosition } from "./editor-state";

type SelectionBarProps = {
  layout: DrillLayout;
  selected: string | null;
  onDelete: () => void;
};

/** What is selected, where it is, and how to move it. Announced as it changes. */
export function SelectionBar({ layout, selected, onDelete }: SelectionBarProps) {
  const position = selected ? selectionPosition(layout, selected) : null;
  const canDelete = selected !== null && selected !== CUE_BALL_ID;
  const deleteLabel = selected === LANDING_ZONE_ID ? "Remove zone" : "Delete ball";

  return (
    <div
      role="status"
      data-testid="table-editor-selection"
      className="flex min-h-[58px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm"
    >
      {selected && position ? (
        <>
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-full border border-control"
            style={{
              background: selected === LANDING_ZONE_ID ? "rgba(233,196,106,0.5)" : ballColor(selected),
            }}
          />
          <span className="font-semibold">{selectionLabel(selected)}</span>
          <span className="font-mono text-[13px] text-muted">
            x {position.x.toFixed(3)} · y {position.y.toFixed(3)}
          </span>
          <span className="hidden text-muted md:inline">Drag, or arrow keys nudge 0.05 (Shift for 0.01)</span>
          <Button
            variant="ghost"
            className="ml-auto w-11 shrink-0 px-0 md:w-auto md:px-4"
            disabled={!canDelete}
            aria-label={deleteLabel}
            data-testid="table-editor-delete"
            onClick={onDelete}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="md:hidden">
              <path
                d="M3 5 H15 M7 5 V3 H11 V5 M5 5 L6 15 H12 L13 5"
                stroke="currentColor"
                strokeWidth="1.7"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden md:inline">{deleteLabel}</span>
          </Button>
        </>
      ) : (
        <span className="text-muted">Nothing selected. Tap a ball or the zone.</span>
      )}
    </div>
  );
}
