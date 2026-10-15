import type { Metadata } from "next";

import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";

export const metadata: Metadata = { title: "Progress · Cue Sense" };

export default function ProgressPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Progress" />
      <EmptyState testId="progress-empty" title="No progress to show" body="Charts appear here after you log attempts in practice sessions." />
    </div>
  );
}
