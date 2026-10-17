import { LinkButton } from "@/components/ui/link-button";

export default function SessionNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8" data-testid="session-not-found">
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line p-10">
        <h1 className="font-display text-3xl font-semibold">Not found</h1>
        <p className="text-muted">This session or drill run does not exist, or the link is wrong.</p>
        <LinkButton href="/sessions" variant="primary" data-testid="session-not-found-back">
          Back to sessions
        </LinkButton>
      </div>
    </div>
  );
}
