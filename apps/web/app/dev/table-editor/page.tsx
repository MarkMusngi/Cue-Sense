"use client";

import { useState } from "react";

import { TableEditor } from "@/components/table-editor/table-editor";
import type { BallInHand, Layout } from "@/lib/layout";
import { sampleLayout } from "@/lib/sample-layouts";

// Dev-only preview of the table editor, for reviewing each build step.
export default function TableEditorPreviewPage() {
  const [layout, setLayout] = useState<Layout>(sampleLayout);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Table editor preview</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Editor</h2>
        {/* Stands in for the drill form, which owns ball in hand (Prompt 7). */}
        <label className="flex items-center gap-2 text-sm">
          Ball in hand
          <select
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            value={layout.cue_ball.ball_in_hand}
            onChange={(event) =>
              setLayout({
                ...layout,
                cue_ball: { ...layout.cue_ball, ball_in_hand: event.target.value as BallInHand },
              })
            }
            data-testid="ball-in-hand"
          >
            <option value="none">None</option>
            <option value="anywhere">Anywhere</option>
            <option value="behind_head_string">Behind the head string</option>
          </select>
        </label>
        <TableEditor layout={layout} onChange={setLayout} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Read-only thumbnail</h2>
        <div className="w-64">
          <TableEditor layout={layout} readOnly />
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Layout JSON</h2>
        <pre
          className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-900"
          data-testid="layout-json"
        >
          {JSON.stringify(layout, null, 2)}
        </pre>
      </section>
    </main>
  );
}
