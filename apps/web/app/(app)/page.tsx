import { PageHeader } from "@/components/page/page-header";
import { getHealth } from "@/lib/api-client";

// Render on every request so the page always shows the current API status.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const health = await getHealth();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Cue Sense" />
      <section className="max-w-md rounded-[14px] border border-line bg-surface p-5">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">API health</h2>
        {health.ok ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2" data-testid="health-status">
            <dt className="text-muted">Status</dt>
            <dd className="font-mono" data-testid="health-api">
              {health.data.status}
            </dd>
            <dt className="text-muted">Database</dt>
            <dd className="font-mono" data-testid="health-database">
              {health.data.database}
            </dd>
          </dl>
        ) : (
          <p className="text-miss" data-testid="health-error">
            {health.error}
          </p>
        )}
      </section>
    </div>
  );
}
