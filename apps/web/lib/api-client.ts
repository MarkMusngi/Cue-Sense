// Response types mirror the API JSON and stay snake_case (README decision 7).
export type HealthResponse = {
  status: string;
  database: string;
};

export type HealthResult =
  | { ok: true; data: HealthResponse }
  | { ok: false; error: string };

export type DrillStatus = "draft" | "active" | "archived";

export type TagRead = {
  id: string;
  name: string;
  category: "skill" | "custom";
  created_at: string;
};

export type PocketName =
  | "top_left"
  | "top_middle"
  | "top_right"
  | "bottom_left"
  | "bottom_middle"
  | "bottom_right";

// Layout JSON in diamond units (README decision 1).
export type DrillLayout = {
  schema_version: number;
  cue_ball: { id: string; x: number; y: number; ball_in_hand: string };
  object_balls: { id: string; number: number | null; x: number; y: number }[];
  targets: (
    | { id: string; kind: "pocket"; pocket: PocketName; ball_id?: string | null }
    | {
        id: string;
        kind: "zone";
        shape: "circle" | "rect";
        x: number;
        y: number;
        radius?: number | null;
        width?: number | null;
        height?: number | null;
      }
  )[];
  annotations: (
    | { id: string; kind: "arrow" | "line"; points: { x: number; y: number }[] }
    | { id: string; kind: "text"; x: number; y: number; text: string }
  )[];
};

export type DrillScoring = {
  kind: "success_count" | "streak" | "points" | "timed";
  attempts_per_set?: number;
  pass_threshold?: number;
  streak_length?: number;
  max_points_per_attempt?: number;
  time_limit_seconds?: number;
};

export type DrillRead = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: number;
  status: DrillStatus;
  created_at: string;
  updated_at: string;
  tags: TagRead[];
  current_version: {
    id: string;
    version_number: number;
    instructions: string;
    layout: DrillLayout;
    scoring: DrillScoring;
    created_at: string;
  } | null;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type DrillFilters = {
  status?: DrillStatus;
  difficulty?: number;
  tag_id?: string;
  search?: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

// Server-side only: in Docker Compose the API is reachable at http://api:8000.
export function getApiUrl(): string {
  return process.env.API_URL ?? "http://localhost:8000";
}

export async function getHealth(): Promise<HealthResult> {
  try {
    const response = await fetch(`${getApiUrl()}/health`, { cache: "no-store" });
    const data = (await response.json()) as HealthResponse;
    return response.ok
      ? { ok: true, data }
      : { ok: false, error: `API returned ${response.status} (database: ${data.database})` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach the API: ${message}` };
  }
}

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${getApiUrl()}${path}`, { cache: "no-store" });
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } }).error;
      return {
        ok: false,
        code: error?.code,
        error: error?.message ?? `API returned ${response.status}`,
      };
    }
    return { ok: true, data: body as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach the API: ${message}` };
  }
}

export function getDrills(filters: DrillFilters = {}): Promise<ApiResult<Page<DrillRead>>> {
  const params = new URLSearchParams({ limit: "100" });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return getJson<Page<DrillRead>>(`/drills?${params.toString()}`);
}

export function getTags(): Promise<ApiResult<Page<TagRead>>> {
  return getJson<Page<TagRead>>("/tags?limit=100");
}
