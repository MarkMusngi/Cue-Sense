"use client";

import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";
import { SNAP_STEP } from "@/lib/layout";

import type { Tool } from "./editor-state";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "M5 3 L5 15 L8.5 11.5 L11 17 L13 16 L10.5 10.5 L15 10.5 Z" },
  { id: "ball", label: "Ball", icon: "M10 3 A7 7 0 1 0 10.01 3 M10 7 V13 M7 10 H13" },
  {
    id: "pocket",
    label: "Pocket target",
    icon: "M3 3 H9 M3 3 V9 M3 3 L10 10 M13 13 A3 3 0 1 0 13.01 13",
  },
  { id: "zone", label: "Landing zone", icon: "M10 3 A7 7 0 1 0 10.01 3" },
];

const BASE =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border px-3 " +
  "text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45";
const OFF = "border-control bg-surface text-text hover:bg-raised";
const ON = "border-chalk bg-chalk-soft font-semibold text-chalk";

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  "data-testid": string;
};

function ToolbarButton({ pressed, className, ...rest }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(BASE, pressed ? ON : OFF, className)}
      {...rest}
    />
  );
}

type EditorToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  isSnapping: boolean;
  onSnapChange: (isSnapping: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onMirrorHorizontal: () => void;
  onMirrorVertical: () => void;
};

/** Tools on the left, actions on the right; wraps on a desktop and scrolls on a phone. */
export function EditorToolbar(props: EditorToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Table editor"
      data-testid="table-editor-toolbar"
      className="flex gap-x-5 gap-y-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
    >
      <div role="group" aria-label="Tools" className="flex shrink-0 gap-1.5">
        {TOOLS.map((tool) => (
          <ToolbarButton
            key={tool.id}
            pressed={props.tool === tool.id}
            data-testid={`table-editor-tool-${tool.id}`}
            title={tool.label}
            onClick={() => props.onToolChange(tool.id)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d={tool.icon}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {tool.label}
          </ToolbarButton>
        ))}
      </div>
      <div role="group" aria-label="Actions" className="flex shrink-0 gap-1.5">
        <ToolbarButton
          pressed={props.isSnapping}
          data-testid="table-editor-snap"
          onClick={() => props.onSnapChange(!props.isSnapping)}
        >
          Snap {SNAP_STEP}
        </ToolbarButton>
        <ToolbarButton data-testid="table-editor-undo" disabled={!props.canUndo} onClick={props.onUndo}>
          Undo
        </ToolbarButton>
        <ToolbarButton data-testid="table-editor-redo" disabled={!props.canRedo} onClick={props.onRedo}>
          Redo
        </ToolbarButton>
        <ToolbarButton data-testid="table-editor-mirror-h" onClick={props.onMirrorHorizontal}>
          Mirror H
        </ToolbarButton>
        <ToolbarButton data-testid="table-editor-mirror-v" onClick={props.onMirrorVertical}>
          Mirror V
        </ToolbarButton>
        <ToolbarButton data-testid="table-editor-reset" disabled={!props.canReset} onClick={props.onReset}>
          Reset
        </ToolbarButton>
      </div>
    </div>
  );
}
