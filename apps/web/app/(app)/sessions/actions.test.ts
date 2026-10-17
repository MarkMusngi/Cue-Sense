import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, client } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  client: {
    createAttempt: vi.fn(),
    endDrillRun: vi.fn(),
    finishSession: vi.fn(),
    getSessions: vi.fn(),
    setAttemptVoided: vi.fn(),
    startDrillRun: vi.fn(),
    startSession: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api-client", () => client);

import {
  endRunAction,
  finishSessionAction,
  logAttemptAction,
  startDrillRunAction,
  startRunInSessionAction,
  startSessionAction,
  voidAttemptAction,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

const OPEN = { id: "s-open", started_at: "2026-10-16T10:00:00Z", ended_at: null };
const ENDED = { ...OPEN, id: "s-old", ended_at: "2026-10-15T11:00:00Z" };

describe("startDrillRunAction", () => {
  it("joins the open session instead of starting another", async () => {
    client.getSessions.mockResolvedValue({ ok: true, data: { items: [OPEN] } });
    client.startDrillRun.mockResolvedValue({ ok: true, data: { id: "r1" } });

    const result = await startDrillRunAction("d1");

    expect(client.startSession).not.toHaveBeenCalled();
    expect(client.startDrillRun).toHaveBeenCalledWith("s-open", "d1");
    expect(result).toEqual({ ok: true, data: { session_id: "s-open", run_id: "r1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/sessions");
  });

  it("starts a session when the newest one has ended, or there is none", async () => {
    client.startSession.mockResolvedValue({ ok: true, data: { id: "s-new" } });
    client.startDrillRun.mockResolvedValue({ ok: true, data: { id: "r1" } });

    client.getSessions.mockResolvedValueOnce({ ok: true, data: { items: [ENDED] } });
    expect(await startDrillRunAction("d1")).toEqual({
      ok: true,
      data: { session_id: "s-new", run_id: "r1" },
    });

    client.getSessions.mockResolvedValueOnce({ ok: true, data: { items: [] } });
    await startDrillRunAction("d1");
    expect(client.startSession).toHaveBeenCalledTimes(2);
  });

  it("returns the API's error when the drill cannot be started, such as an archived one", async () => {
    const failed = { ok: false, code: "drill_archived", error: "Archived." };
    client.getSessions.mockResolvedValue({ ok: true, data: { items: [OPEN] } });
    client.startDrillRun.mockResolvedValue(failed);

    expect(await startDrillRunAction("d1")).toBe(failed);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the error when sessions cannot be read", async () => {
    const failed = { ok: false, error: "Could not reach the API" };
    client.getSessions.mockResolvedValue(failed);

    expect(await startDrillRunAction("d1")).toBe(failed);
    expect(client.startDrillRun).not.toHaveBeenCalled();
  });
});

describe("other session actions", () => {
  it("starts a session and refreshes the list", async () => {
    client.startSession.mockResolvedValue({ ok: true, data: { id: "s1" } });

    await startSessionAction();

    expect(revalidatePath).toHaveBeenCalledWith("/sessions");
  });

  it("adds a run to the session being viewed", async () => {
    client.startDrillRun.mockResolvedValue({ ok: true, data: { id: "r2" } });

    const result = await startRunInSessionAction("s1", "d2");

    expect(client.startDrillRun).toHaveBeenCalledWith("s1", "d2");
    expect(result).toEqual({ ok: true, data: { session_id: "s1", run_id: "r2" } });
    expect(revalidatePath).toHaveBeenCalledWith("/sessions/s1");
  });

  it("logs an attempt with its key and input, untouched", async () => {
    client.createAttempt.mockResolvedValue({ ok: true, data: { id: "a1" } });

    await logAttemptAction("r1", "key-1", { outcome: "success" });

    expect(client.createAttempt).toHaveBeenCalledWith("r1", "key-1", { outcome: "success" });
  });

  it("undoes an attempt with the server's clock", async () => {
    client.setAttemptVoided.mockResolvedValue({ ok: true, data: { id: "a1" } });

    await voidAttemptAction("a1");

    const [id, when] = client.setAttemptVoided.mock.calls[0];
    expect(id).toBe("a1");
    expect(Number.isNaN(Date.parse(when))).toBe(false);
  });

  it("ends a run and finishes a session with the server's clock, then refreshes", async () => {
    client.endDrillRun.mockResolvedValue({ ok: true, data: {} });
    client.finishSession.mockResolvedValue({ ok: true, data: {} });

    await endRunAction("r1", "s1");
    await finishSessionAction("s1");

    expect(Number.isNaN(Date.parse(client.endDrillRun.mock.calls[0][1]))).toBe(false);
    expect(Number.isNaN(Date.parse(client.finishSession.mock.calls[0][1]))).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/sessions/s1");
    expect(revalidatePath).toHaveBeenCalledWith("/sessions");
  });

  it("does not refresh when ending a run fails", async () => {
    client.endDrillRun.mockResolvedValue({ ok: false, code: "drill_run_ended", error: "Ended." });

    await endRunAction("r1", "s1");

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
