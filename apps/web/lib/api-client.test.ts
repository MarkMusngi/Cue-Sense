import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changeDrillStatus,
  createAttempt,
  createDrill,
  createTag,
  duplicateDrill,
  endDrillRun,
  finishSession,
  getAttempts,
  getDrill,
  getDrillVersions,
  getSessions,
  setAttemptVoided,
  startDrillRun,
  startSession,
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

describe("sessions, drill runs and attempts", () => {
  it("starts a session with an empty JSON body", async () => {
    const fetchMock = respond(201, { id: "s1" });

    await startSession();

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/practice-sessions$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it("lists sessions with the page asked for", async () => {
    const fetchMock = respond(200, { items: [] });

    await getSessions(5, 10);

    expect(lastRequest(fetchMock).url).toMatch(/\/practice-sessions\?limit=5&offset=10$/);
  });

  it("finishes a session and ends a drill run with an end time", async () => {
    const finish = respond(200, { id: "s1" });
    await finishSession("s1", "2026-10-16T10:00:00Z");
    expect(lastRequest(finish).init.method).toBe("PATCH");
    expect(JSON.parse(lastRequest(finish).init.body as string)).toEqual({
      ended_at: "2026-10-16T10:00:00Z",
    });

    const end = respond(200, { id: "r1" });
    await endDrillRun("r1", "2026-10-16T10:05:00Z");
    expect(lastRequest(end).url).toMatch(/\/drill-runs\/r1$/);
    expect(JSON.parse(lastRequest(end).init.body as string)).toEqual({
      ended_at: "2026-10-16T10:05:00Z",
    });
  });

  it("starts a drill run on a drill", async () => {
    const fetchMock = respond(201, { id: "r1" });

    await startDrillRun("s1", "d1");

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/practice-sessions\/s1\/drill-runs$/);
    expect(JSON.parse(init.body as string)).toEqual({ drill_id: "d1" });
  });

  it("logs an attempt with the Idempotency-Key header and the tap's body", async () => {
    const fetchMock = respond(201, { id: "a1" });

    await createAttempt("r1", "11111111-1111-4111-8111-111111111111", {
      outcome: "success",
      tapped_at: "2026-10-16T10:00:00Z",
    });

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/drill-runs\/r1\/attempts$/);
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      outcome: "success",
      tapped_at: "2026-10-16T10:00:00Z",
    });
  });

  it("undoes an attempt with a time and restores it with null", async () => {
    const undo = respond(200, { id: "a1" });
    await setAttemptVoided("a1", "2026-10-16T10:00:00Z");
    expect(lastRequest(undo).url).toMatch(/\/attempts\/a1$/);
    expect(JSON.parse(lastRequest(undo).init.body as string)).toEqual({
      voided_at: "2026-10-16T10:00:00Z",
    });

    const restore = respond(200, { id: "a1" });
    await setAttemptVoided("a1", null);
    expect(JSON.parse(lastRequest(restore).init.body as string)).toEqual({ voided_at: null });
  });

  it("reads every page of a run's attempts", async () => {
    const attempt = (n: number) => ({ id: `a${n}`, attempt_number: n });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [attempt(1), attempt(2)], total: 3, limit: 100, offset: 0 })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [attempt(3)], total: 3, limit: 100, offset: 100 })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAttempts("r1");

    expect(result).toEqual({ ok: true, data: [attempt(1), attempt(2), attempt(3)] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string])[0]).toMatch(/limit=100&offset=100$/);
  });

  it("stops at the first failing page", async () => {
    respond(404, { error: { code: "not_found", message: "Drill run not found." } });

    const result = await getAttempts("r1");

    expect(result).toMatchObject({ ok: false, code: "not_found" });
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
