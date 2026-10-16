import type { DrillStatus } from "@/lib/api-client";

/** The drill library's filters as they appear in the URL, already checked. */
export type LibraryParams = {
  status?: DrillStatus;
  difficulty?: string;
  tag_id?: string;
  search?: string;
  sort?: "name" | "difficulty";
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH_LENGTH = 100;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v === "" ? undefined : v;
}

/** Keep only values the API accepts, so an edited URL never turns into a 422. */
export function readLibraryParams(raw: RawSearchParams): LibraryParams {
  const status = first(raw.status);
  const difficulty = first(raw.difficulty);
  const tagId = first(raw.tag_id);
  const search = first(raw.search)?.trim();
  const sort = first(raw.sort);
  return {
    status: status === "draft" || status === "active" || status === "archived" ? status : undefined,
    difficulty: difficulty && /^[1-5]$/.test(difficulty) ? difficulty : undefined,
    tag_id: tagId && UUID.test(tagId) ? tagId : undefined,
    search: search && search.length <= MAX_SEARCH_LENGTH ? search : undefined,
    sort: sort === "difficulty" ? "difficulty" : sort === "name" ? "name" : undefined,
  };
}
