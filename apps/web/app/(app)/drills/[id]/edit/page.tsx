import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DrillEditor } from "@/components/drill-editor/drill-editor";
import { ErrorCard } from "@/components/state-cards";
import { getDrill, getTags } from "@/lib/api-client";

export const metadata: Metadata = { title: "Edit drill · Cue Sense" };

// Render on every request: the editor must start from the current version.
export const dynamic = "force-dynamic";

export default async function EditDrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [drill, tags] = await Promise.all([getDrill(id), getTags()]);

  if (!drill.ok) {
    if (drill.code === "not_found" || drill.code === "validation_failed") notFound();
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <ErrorCard message={drill.error} code={drill.code} />
      </div>
    );
  }
  if (!tags.ok) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <ErrorCard message={tags.error} code={tags.code} />
      </div>
    );
  }
  // Keyed by version so a fresh version after a reload starts a fresh form.
  return (
    <DrillEditor
      key={drill.data.current_version?.id ?? drill.data.id}
      drill={drill.data}
      tags={tags.data.items}
    />
  );
}
