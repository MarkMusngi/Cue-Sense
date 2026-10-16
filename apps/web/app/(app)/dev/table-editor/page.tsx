import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TableEditorPreview } from "./table-editor-preview";

export const metadata: Metadata = { title: "Table editor · Cue Sense" };

/** The table editor on its own, with the live layout JSON. Not served in production. */
export default function DevTableEditorPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TableEditorPreview />;
}
