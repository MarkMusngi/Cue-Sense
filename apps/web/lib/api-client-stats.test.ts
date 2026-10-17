import { afterEach, describe, expect, it, vi } from "vitest";

import { getDrillSuccessRate, getTagStats, getWeeklyVolume } from "@/lib/api-client";

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastUrl(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls[0][0] as string;
}

afterEach(() => vi.unstubAllGlobals());

const RANGE = { from: "2026-10-01", to: "2026-10-31" };

describe("stats calls", () => {
  it("asks for one drill's success rate with the range and bucket", async () => {
    const fetchMock = respond(200, { drill_id: "d 1", points: [] });

    const result = await getDrillSuccessRate("d 1", RANGE, "week");

    expect(lastUrl(fetchMock)).toMatch(
      /\/stats\/drills\/d%201\/success-rate\?from=2026-10-01&to=2026-10-31&bucket=week$/,
    );
    expect(result.ok).toBe(true);
  });

  it("asks for weekly volume and tags with the range", async () => {
    const volume = respond(200, { from: RANGE.from, to: RANGE.to, items: [] });
    await getWeeklyVolume(RANGE);
    expect(lastUrl(volume)).toMatch(/\/stats\/weekly-volume\?from=2026-10-01&to=2026-10-31$/);

    const tags = respond(200, { from: RANGE.from, to: RANGE.to, items: [] });
    await getTagStats(RANGE);
    expect(lastUrl(tags)).toMatch(/\/stats\/tags\?from=2026-10-01&to=2026-10-31$/);
  });

  it("passes an API error on", async () => {
    respond(404, { error: { code: "not_found", message: "Drill not found.", details: [] } });

    const result = await getDrillSuccessRate("missing", RANGE, "day");

    expect(result).toEqual({ ok: false, code: "not_found", error: "Drill not found." });
  });
});
