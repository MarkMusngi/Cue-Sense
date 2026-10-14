// Response types mirror the API JSON and stay snake_case (README decision 7).
export type HealthResponse = {
  status: string;
  database: string;
};

export type HealthResult =
  | { ok: true; data: HealthResponse }
  | { ok: false; error: string };

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
