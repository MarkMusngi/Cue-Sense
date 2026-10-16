/** Placeholder body for a section whose screen is not built yet. */
export function EmptyState({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <section data-testid={testId} className="rounded-[14px] border border-dashed border-control p-6 md:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-prose text-[15px] text-muted">{body}</p>
    </section>
  );
}
