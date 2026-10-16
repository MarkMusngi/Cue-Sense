import type { Metadata } from "next";

import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";

export const metadata: Metadata = { title: "Drills · Cue Sense" };

export default function DrillsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Drills" />
      <EmptyState testId="drills-empty" title="No drills yet" body="The drill library and editor arrive in a later update." />
    </div>
  );
}
