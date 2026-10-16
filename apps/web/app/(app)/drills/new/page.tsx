import type { Metadata } from "next";

import { DrillEditor } from "@/components/drill-editor/drill-editor";
import { ErrorCard } from "@/components/state-cards";
import { getTags } from "@/lib/api-client";

export const metadata: Metadata = { title: "New drill · Cue Sense" };

// Render on every request so the tag list is current.
export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  const tags = await getTags();
  if (!tags.ok) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <ErrorCard message={tags.error} code={tags.code} />
      </div>
    );
  }
  return <DrillEditor tags={tags.data.items} />;
}
