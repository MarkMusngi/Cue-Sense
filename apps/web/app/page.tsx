import { DrillCard } from "@/components/drill-card";
import { DrillFilters, type FilterParams } from "@/components/drill-filters";
import { EmptyState, ErrorCard } from "@/components/state-cards";
import { getDrills, getHealth, getTags, type DrillFilters as DrillQuery } from "@/lib/api-client";

// Render on every request so the page always shows current API data.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "" ? undefined : v;
}

function readParams(raw: SearchParams): FilterParams {
  const status = first(raw.status);
  return {
    status: status === "draft" || status === "active" || status === "archived" ? status : undefined,
    difficulty: first(raw.difficulty),
    tag_id: first(raw.tag_id),
    search: first(raw.search),
    sort: first(raw.sort),
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = readParams(await searchParams);
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

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-[clamp(16px,4vw,48px)] pb-12 pt-8">
      <div>
        <h1 className="font-display text-[44px] font-bold leading-none">Drills</h1>
        {drills.ok && (
          <p className="mt-1.5 text-[15px] text-muted" data-testid="drill-count">
            {drills.data.total} {drills.data.total === 1 ? "drill" : "drills"}
          </p>
        )}
      </div>

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

      <footer className="text-[13px] text-muted">
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
    </main>
  );
}
