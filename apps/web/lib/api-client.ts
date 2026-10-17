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

export type LayoutTable = { kind: "pool"; size_ft: 9 };

// Layout JSON, schema version 2, in diamond units (README decision 1, ADR 0008).
export type DrillLayout = {
  schema_version: number;
  table: LayoutTable;
  cue_ball: { id: string; x: number; y: number };
  object_balls: { id: string; x: number; y: number }[];
  /** A fixed-size circle (radius 0.5 diamonds) centred here. */
  landing_zone?: { x: number; y: number } | null;
  cue_spin?: { x: number; y: number } | null;
  target_pocket?: PocketName | null;
};

// Scoring JSON, schema version 1, discriminated by kind (docs/architecture.md section 4.4).
export type SuccessCountScoring = {
  schema_version: number;
  kind: "success_count";
  attempts_per_set: number;
  pass_threshold: number;
};
export type StreakScoring = { schema_version: number; kind: "streak"; streak_length: number };
export type PointsScoring = {
  schema_version: number;
  kind: "points";
  attempts_per_set: number;
  max_points_per_attempt: number;
  /** Total points per set. */
  pass_threshold: number;
};
export type TimedScoring = {
  schema_version: number;
  kind: "timed";
  attempts_per_set: number;
  time_limit_seconds: number;
  pass_threshold: number;
};
export type DrillScoring = SuccessCountScoring | StreakScoring | PointsScoring | TimedScoring;
export type ScoringKind = DrillScoring["kind"];

export type DrillVersionRead = {
  id: string;
  version_number: number;
  instructions: string;
  layout: DrillLayout;
  scoring: DrillScoring;
  created_at: string;
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
  current_version: DrillVersionRead | null;
};

/** What a drill save carries (POST /drills, PUT /drills/{id}). */
export type DrillContent = {
  title: string;
  description?: string | null;
  difficulty: number;
  tag_ids: string[];
  instructions: string;
  layout: DrillLayout;
  scoring: DrillScoring;
};

export type DrillUpdate = DrillContent & {
  /** The version that was edited; a different current version is a 409 stale_version. */
  base_drill_version_id: string;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type DrillFilters = {
  status?: DrillStatus;
  difficulty?: number;
  tag_id?: string;
  search?: string;
};

/** One problem in an API error: where it is (a path into the request body) and what. */
export type ApiErrorDetail = { code: string; message: string; path: (string | number)[] };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; details?: ApiErrorDetail[] };

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

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ApiResult<T>> {
  try {
    const headers = {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extraHeaders,
    };
    const response = await fetch(`${getApiUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!response.ok) {
      const error = (parsed as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } })
        ?.error;
      return {
        ok: false,
        code: error?.code,
        error: error?.message ?? `API returned ${response.status}`,
        details: error?.details?.length ? error.details : undefined,
      };
    }
    return { ok: true, data: parsed as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach the API: ${message}` };
  }
}

function getJson<T>(path: string): Promise<ApiResult<T>> {
  return request<T>("GET", path);
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

export function getDrill(id: string): Promise<ApiResult<DrillRead>> {
  return getJson<DrillRead>(`/drills/${encodeURIComponent(id)}`);
}

export function getDrillVersions(id: string): Promise<ApiResult<Page<DrillVersionRead>>> {
  return getJson<Page<DrillVersionRead>>(`/drills/${encodeURIComponent(id)}/versions?limit=100`);
}

export function createDrill(content: DrillContent): Promise<ApiResult<DrillRead>> {
  return request<DrillRead>("POST", "/drills", content);
}

export function duplicateDrill(sourceDrillId: string): Promise<ApiResult<DrillRead>> {
  return request<DrillRead>("POST", "/drills", { source_drill_id: sourceDrillId });
}

export function updateDrill(id: string, body: DrillUpdate): Promise<ApiResult<DrillRead>> {
  return request<DrillRead>("PUT", `/drills/${encodeURIComponent(id)}`, body);
}

export function changeDrillStatus(id: string, status: DrillStatus): Promise<ApiResult<DrillRead>> {
  return request<DrillRead>("PATCH", `/drills/${encodeURIComponent(id)}`, { status });
}

export function createTag(name: string): Promise<ApiResult<TagRead>> {
  return request<TagRead>("POST", "/tags", { name });
}

// Practice sessions, drill runs and attempts (docs/architecture.md section 4.6).

export type Outcome = "success" | "fail" | "partial";

/** Where a drill run stands in its current set; computed by the server (section 4.4). */
export type SetProgress = {
  set_number: number;
  attempts_in_set: number;
  successes: number;
  points: number | null;
  set_complete: boolean;
  set_passed: boolean | null;
  success_rate: number | null;
  current_streak: number | null;
  best_streak: number | null;
};

export type PracticeSessionRead = {
  id: string;
  started_at: string;
  ended_at: string | null;
  location: string | null;
  notes: string | null;
};

export type DrillRunRead = {
  id: string;
  practice_session_id: string;
  drill_id: string;
  /** The version the run started with; the runner always shows this one. */
  drill_version_id: string;
  run_number: number;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  set_progress: SetProgress;
};

export type PracticeSessionDetail = PracticeSessionRead & { drill_runs: DrillRunRead[] };

/** An attempt in a run's list; voided_at is set for an undone attempt. */
export type AttemptSummary = {
  id: string;
  attempt_number: number;
  outcome: Outcome;
  points: number | null;
  duration_ms: number | null;
  tapped_at: string;
  recorded_at: string;
  voided_at: string | null;
  notes: string | null;
};

export type AttemptRead = AttemptSummary & { drill_run_id: string; set_progress: SetProgress };

/** What a scoring kind needs: success_count and streak send outcome; points sends points;
 *  timed sends outcome and duration_ms. */
export type AttemptInput = {
  outcome?: Outcome;
  points?: number;
  duration_ms?: number;
  tapped_at?: string;
};

export function getSessions(limit = 20, offset = 0): Promise<ApiResult<Page<PracticeSessionRead>>> {
  return getJson<Page<PracticeSessionRead>>(`/practice-sessions?limit=${limit}&offset=${offset}`);
}

export function getSession(id: string): Promise<ApiResult<PracticeSessionDetail>> {
  return getJson<PracticeSessionDetail>(`/practice-sessions/${encodeURIComponent(id)}`);
}

/** Starts a session; the API closes any open one first. */
export function startSession(): Promise<ApiResult<PracticeSessionRead>> {
  return request<PracticeSessionRead>("POST", "/practice-sessions", {});
}

export function finishSession(id: string, endedAt: string): Promise<ApiResult<PracticeSessionRead>> {
  return request<PracticeSessionRead>("PATCH", `/practice-sessions/${encodeURIComponent(id)}`, {
    ended_at: endedAt,
  });
}

export function startDrillRun(sessionId: string, drillId: string): Promise<ApiResult<DrillRunRead>> {
  return request<DrillRunRead>(
    "POST",
    `/practice-sessions/${encodeURIComponent(sessionId)}/drill-runs`,
    { drill_id: drillId },
  );
}

export function getDrillRun(id: string): Promise<ApiResult<DrillRunRead>> {
  return getJson<DrillRunRead>(`/drill-runs/${encodeURIComponent(id)}`);
}

export function endDrillRun(id: string, endedAt: string): Promise<ApiResult<DrillRunRead>> {
  return request<DrillRunRead>("PATCH", `/drill-runs/${encodeURIComponent(id)}`, {
    ended_at: endedAt,
  });
}

/** All of a run's attempts in order, voided ones included, fetched a page at a time. */
export async function getAttempts(runId: string): Promise<ApiResult<AttemptSummary[]>> {
  const limit = 100;
  const all: AttemptSummary[] = [];
  // A bound, so a misbehaving API cannot keep this loop going.
  for (let page = 0; page < 50; page++) {
    const result = await getJson<Page<AttemptSummary>>(
      `/drill-runs/${encodeURIComponent(runId)}/attempts?limit=${limit}&offset=${page * limit}`,
    );
    if (!result.ok) return result;
    all.push(...result.data.items);
    if (all.length >= result.data.total || result.data.items.length === 0) break;
  }
  return { ok: true, data: all };
}

/** Logs one attempt. Send the same key to retry the same tap: a replay returns the original. */
export function createAttempt(
  runId: string,
  idempotencyKey: string,
  input: AttemptInput,
): Promise<ApiResult<AttemptRead>> {
  return request<AttemptRead>(
    "POST",
    `/drill-runs/${encodeURIComponent(runId)}/attempts`,
    input,
    { "Idempotency-Key": idempotencyKey },
  );
}

/** Undo an attempt with a time, or restore it with null. */
export function setAttemptVoided(
  attemptId: string,
  voidedAt: string | null,
): Promise<ApiResult<AttemptRead>> {
  return request<AttemptRead>("PATCH", `/attempts/${encodeURIComponent(attemptId)}`, {
    voided_at: voidedAt,
  });
}
