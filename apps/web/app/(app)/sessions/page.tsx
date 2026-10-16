import type { Metadata } from "next";

import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";

export const metadata: Metadata = { title: "Sessions · Cue Sense" };

export default function SessionsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Sessions" />
      <EmptyState testId="sessions-empty" title="No practice sessions yet" body="Start a practice session here once the session runner is built." />
    </div>
  );
}
