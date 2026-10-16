import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changeDrillStatus,
  createDrill,
  createTag,
  duplicateDrill,
  getDrill,
  getDrillVersions,
  updateDrill,
  type DrillContent,
  type DrillUpdate,
} from "@/lib/api-client";
import { emptyForm, toContent } from "@/lib/drill-form";

function respond(status: number, body: unknown, rawText?: string) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(rawText ?? (body === undefined ? "" : JSON.stringify(body)), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONTENT: DrillContent = toContent({ ...emptyForm(), title: "T", instructions: "I" });

describe("mutations", () => {
  it("creates a drill with a JSON body", async () => {
    const fetchMock = respond(201, { id: "d1" });

    const result = await createDrill(CONTENT);

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/drills$/);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(CONTENT);
    expect(result).toEqual({ ok: true, data: { id: "d1" } });
  });

  it("duplicates with the source id alone", async () => {
    const fetchMock = respond(201, { id: "d2" });

    await duplicateDrill("d1");

    expect(JSON.parse(lastRequest(fetchMock).init.body as string)).toEqual({
      source_drill_id: "d1",
    });
  });

  it("updates with PUT and the base version id", async () => {
    const fetchMock = respond(200, { id: "d1" });
    const body: DrillUpdate = { ...CONTENT, base_drill_version_id: "v1" };

    await updateDrill("d1", body);

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/drills\/d1$/);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string).base_drill_version_id).toBe("v1");
  });

  it("changes status with PATCH", async () => {
    const fetchMock = respond(200, { id: "d1" });

    await changeDrillStatus("d1", "archived");

    const { init } = lastRequest(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "archived" });
  });

  it("creates a tag by name", async () => {
    const fetchMock = respond(201, { id: "t1", name: "Aim" });

    await createTag("Aim");

    expect(JSON.parse(lastRequest(fetchMock).init.body as string)).toEqual({ name: "Aim" });
  });
});

describe("reads", () => {
  it("encodes the id and sends no body", async () => {
    const fetchMock = respond(200, { id: "a b" });

    await getDrill("a b");

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/drills\/a%20b$/);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("asks for up to 100 versions", async () => {
    const fetchMock = respond(200, { items: [] });

    await getDrillVersions("d1");

    expect(lastRequest(fetchMock).url).toMatch(/\/drills\/d1\/versions\?limit=100$/);
  });
});

describe("errors", () => {
  it("returns the API's code, message and details", async () => {
    const details = [{ code: "balls_overlap", message: "m", path: ["layout", "object_balls", 1] }];
    respond(422, {
      error: { code: "validation_failed", message: "The drill is invalid.", details },
    });

    const result = await createDrill(CONTENT);

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      error: "The drill is invalid.",
      details,
    });
  });

  it("leaves details out when the API sent none", async () => {
    respond(409, { error: { code: "stale_version", message: "Reload.", details: [] } });

    const result = await updateDrill("d1", { ...CONTENT, base_drill_version_id: "v1" });

    expect(result).toEqual({
      ok: false,
      code: "stale_version",
      error: "Reload.",
      details: undefined,
    });
  });

  it("reports the status when the error body is not JSON", async () => {
    respond(502, undefined, "<html>Bad gateway</html>");

    const result = await getDrill("d1");

    expect(result).toEqual({
      ok: false,
      code: undefined,
      error: "API returned 502",
      details: undefined,
    });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    const result = await getDrill("d1");

    expect(result).toEqual({ ok: false, error: "Could not reach the API: connect ECONNREFUSED" });
  });
});
