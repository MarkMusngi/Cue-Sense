import { afterEach, describe, expect, it, vi } from "vitest";

import { getAllDrills } from "@/lib/api-client";

function drills(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `d${from + i}` }));
}

function page(items: unknown[], total: number) {
  return new Response(JSON.stringify({ items, total, limit: 100, offset: 0 }), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("getAllDrills", () => {
  it("reads every page, not just the first 100", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(drills(0, 100), 174))
      .mockResolvedValueOnce(page(drills(100, 74), 174));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAllDrills({ status: "active" });

    expect(result.ok && result.data).toHaveLength(174);
    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toMatch(/limit=100&offset=0&status=active$/);
    expect(urls[1]).toMatch(/limit=100&offset=100&status=active$/);
  });

  it("stops after one page when everything fits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page(drills(0, 5), 5));
    vi.stubGlobal("fetch", fetchMock);

    await getAllDrills();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops on an empty page even if the total says there is more", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([], 500));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAllDrills();

    expect(result).toEqual({ ok: true, data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an API error on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "internal_error", message: "Boom.", details: [] } }), {
          status: 500,
        }),
      ),
    );

    expect(await getAllDrills()).toEqual({ ok: false, code: "internal_error", error: "Boom." });
  });
});
