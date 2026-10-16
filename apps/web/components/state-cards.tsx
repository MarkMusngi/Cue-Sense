export function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-10 text-center"
      data-testid="drills-empty"
    >
      <h2 className="font-display text-2xl font-semibold">
        {filtered ? "No drills match" : "No drills yet"}
      </h2>
      <p className="text-muted">
        {filtered
          ? "Try a different search or clear the filters."
          : "Run the seed script to add the five starter drills."}
      </p>
    </div>
  );
}

export function ErrorCard({ message, code }: { message: string; code?: string }) {
  const devUserMissing = code === "dev_user_missing";
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-miss bg-miss-soft p-5"
      data-testid="drills-error"
    >
      <h2 className="font-display text-2xl font-semibold text-miss">
        {devUserMissing ? "No player set up yet" : "Could not load drills"}
      </h2>
      <p>{message}</p>
      {devUserMissing && (
        <code className="rounded-lg bg-surface p-3 font-mono text-sm">
          docker compose exec api python -m app.scripts.seed
        </code>
      )}
      {code && <p className="font-mono text-xs text-muted">{code}</p>}
    </div>
  );
}
