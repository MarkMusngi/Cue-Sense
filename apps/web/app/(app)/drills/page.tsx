import type { Metadata } from "next";

import { DrillCard } from "@/components/drill-card";
import { DrillFilters } from "@/components/drill-filters";
import { PageHeader } from "@/components/page/page-header";
import { EmptyState, ErrorCard } from "@/components/state-cards";
import { getDrills, getHealth, getTags, type DrillFilters as DrillQuery } from "@/lib/api-client";
import { readLibraryParams, type RawSearchParams } from "@/lib/drill-params";

export const metadata: Metadata = { title: "Drills · Cue Sense" };

// Render on every request so the page always shows current API data.
export const dynamic = "force-dynamic";

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = readLibraryParams(await searchParams);
  const query: DrillQuery = {
    status: params.status,
    difficulty: params.difficulty ? Number(params.difficulty) : undefined,
    tag_id: params.tag_id,
    search: params.search,
  };
  const [drills, tags, health] = await Promise.all([getDrills(query), getTags(), getHealth()]);

  const items = drills.ok
    ? [...drills.data.items].sort((a, b) =>
        params.sort === "difficulty"
          ? a.difficulty - b.difficulty || a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
      )
    : [];
  const isFiltered = Object.values(query).some((v) => v !== undefined);
  const total = drills.ok ? drills.data.total : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Drills">
        {drills.ok && (
          <p className="text-sm text-muted" data-testid="drill-count">
            {items.length < total
              ? `Showing ${items.length} of ${total} drills`
              : `${total} ${total === 1 ? "drill" : "drills"}`}
          </p>
        )}
      </PageHeader>

      <DrillFilters params={params} tags={tags.ok ? tags.data.items : []} />

      {!drills.ok ? (
        <ErrorCard message={drills.error} code={drills.code} />
      ) : items.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
          data-testid="drill-list"
        >
          {items.map((drill) => (
            <DrillCard key={drill.id} drill={drill} />
          ))}
        </ul>
      )}

      <footer className="text-sm text-muted">
        {health.ok ? (
          <p data-testid="health-status">
            API <span data-testid="health-api">{health.data.status}</span> · database{" "}
            <span data-testid="health-database">{health.data.database}</span>
          </p>
        ) : (
          <p className="text-miss" data-testid="health-error">
            {health.error}
          </p>
        )}
      </footer>
    </div>
  );
}
