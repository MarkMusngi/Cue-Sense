"use client";

import { TABLE_VIEW_BOX, TableSurface } from "@/components/table-editor/table-surface";
import type { Layout } from "@/lib/layout";

export type TableEditorProps = {
  /** The layout to show. The editor never mutates it. */
  layout: Layout;
  /** Called with a whole new layout after each edit. Not needed when readOnly. */
  onChange?: (layout: Layout) => void;
  /** Render only: no handlers, toolbar or focus. Used for thumbnails and viewers. */
  readOnly?: boolean;
};

/**
 * SVG table layout editor in diamond units (docs/architecture.md section 4.8).
 * Controlled: the parent owns the layout. See docs/table-editor.md for the design.
 */
export function TableEditor({ layout, readOnly = false }: TableEditorProps) {
  return (
    <svg
      viewBox={TABLE_VIEW_BOX}
      role="img"
      aria-label={`Pool table layout, ${layout.table.size_ft} ft`}
      data-testid="table-editor"
      data-readonly={readOnly}
      className="block h-auto w-full select-none"
    >
      <TableSurface />
    </svg>
  );
}
