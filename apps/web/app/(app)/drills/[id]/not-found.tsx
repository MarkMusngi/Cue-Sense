import { LinkButton } from "@/components/ui/link-button";

export default function DrillNotFound() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-8" data-testid="drill-not-found">
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line p-10">
        <h1 className="font-display text-3xl font-semibold">Drill not found</h1>
        <p className="text-muted">It may have been removed, or the link is wrong.</p>
        <LinkButton href="/drills" variant="primary" data-testid="drill-not-found-back">
          Back to drills
        </LinkButton>
      </div>
    </div>
  );
}
