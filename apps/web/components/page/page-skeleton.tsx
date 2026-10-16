/** A grey placeholder shown while a page's data loads. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="mx-auto flex max-w-5xl animate-pulse flex-col gap-5 p-4 md:p-8"
      data-testid="page-skeleton"
    >
      <div className="h-10 w-2/3 max-w-md rounded-lg bg-raised" />
      <div className="aspect-[8.9/4.9] w-full max-w-3xl rounded-[14px] bg-raised" />
      <div className="h-24 max-w-xl rounded-xl bg-raised" />
    </div>
  );
}
