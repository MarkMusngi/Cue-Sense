import { getHealth } from "@/lib/api-client";

// Render on every request so the page always shows the current API status.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const health = await getHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Cue Sense</h1>
      <section className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <h2 className="mb-2 text-lg font-medium">API health</h2>
        {health.ok ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="health-status">
            <dt className="text-neutral-500">Status</dt>
            <dd data-testid="health-api">{health.data.status}</dd>
            <dt className="text-neutral-500">Database</dt>
            <dd data-testid="health-database">{health.data.database}</dd>
          </dl>
        ) : (
          <p className="text-red-600" data-testid="health-error">
            {health.error}
          </p>
        )}
      </section>
    </main>
  );
}
