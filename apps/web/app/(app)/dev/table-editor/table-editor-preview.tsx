"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page/page-header";
import { TableEditor } from "@/components/table-editor/table-editor";
import type { DrillLayout } from "@/lib/api-client";

const START: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
};

export function TableEditorPreview() {
  const [layout, setLayout] = useState<DrillLayout>(START);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Table editor" />
      <TableEditor layout={layout} onChange={setLayout} />
      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Read-only</h2>
        <div className="max-w-md" data-testid="dev-table-editor-readonly">
          <TableEditor layout={layout} readOnly />
        </div>
      </section>
      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Layout JSON</h2>
        <pre
          className="overflow-x-auto rounded-[10px] border border-line bg-surface p-3 font-mono text-[13px]"
          data-testid="dev-table-editor-json"
        >
          {JSON.stringify(layout, null, 2)}
        </pre>
      </section>
    </div>
  );
}
