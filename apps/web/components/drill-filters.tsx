import Link from "next/link";
import type { DrillStatus, TagRead } from "@/lib/api-client";

export type FilterParams = {
  status?: DrillStatus;
  difficulty?: string;
  tag_id?: string;
  search?: string;
  sort?: string;
};

const STATUSES: { label: string; value: DrillStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "active" },
  { label: "Drafts", value: "draft" },
  { label: "Archived", value: "archived" },
];

function hrefWithStatus(params: FilterParams, status: DrillStatus | undefined): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, status })) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `/drills?${text}` : "/drills";
}

const SELECT_CLASS = "h-10 rounded-[10px] border border-line bg-surface px-2.5 text-sm text-text";

export function DrillFilters({ params, tags }: { params: FilterParams; tags: TagRead[] }) {
  return (
    <form
      method="get"
      role="search"
      aria-label="Filter drills"
      className="flex flex-col gap-4"
      data-testid="drill-filters"
    >
      {params.status && <input type="hidden" name="status" value={params.status} />}
      <label className="relative max-w-[340px]">
        <span className="sr-only">Search drills</span>
        <input
          type="search"
          name="search"
          defaultValue={params.search}
          placeholder="Search title or description"
          data-testid="drill-search"
          className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[15px] text-text"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-4">
        <div
          role="group"
          aria-label="Status"
          className="flex rounded-[10px] border border-line bg-surface p-[3px]"
        >
          {STATUSES.map((s) => {
            const pressed = params.status === s.value;
            return (
              <Link
                key={s.label}
                href={hrefWithStatus(params, s.value)}
                aria-current={pressed ? "true" : undefined}
                data-testid={`status-${s.value ?? "all"}`}
                className={`flex h-9 items-center rounded-lg px-3.5 text-sm ${
                  pressed ? "bg-raised font-semibold text-text" : "text-muted"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Difficulty
          <select name="difficulty" defaultValue={params.difficulty ?? ""} className={SELECT_CLASS}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Tag
          <select name="tag_id" defaultValue={params.tag_id ?? ""} className={SELECT_CLASS}>
            <option value="">Any tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted md:ml-auto">
          Sort
          <select name="sort" defaultValue={params.sort ?? "name"} className={SELECT_CLASS}>
            <option value="name">Name A–Z</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
        <button
          type="submit"
          data-testid="apply-filters"
          className="h-10 rounded-[10px] bg-chalk px-4 text-sm font-semibold text-chalk-ink"
        >
          Apply
        </button>
      </div>
    </form>
  );
}
