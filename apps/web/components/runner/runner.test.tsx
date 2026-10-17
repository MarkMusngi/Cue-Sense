// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApiResult,
  AttemptRead,
  AttemptSummary,
  DrillRunRead,
  DrillScoring,
  DrillVersionRead,
  SetProgress,
} from "@/lib/api-client";
import { emptyForm } from "@/lib/drill-form";
import { computeSetProgress } from "@/lib/set-progress";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const logAttemptAction = vi.fn();
const voidAttemptAction = vi.fn();
const endRunAction = vi.fn();
vi.mock("@/app/(app)/sessions/actions", () => ({
  logAttemptAction: (...args: unknown[]) => logAttemptAction(...args),
  voidAttemptAction: (...args: unknown[]) => voidAttemptAction(...args),
  endRunAction: (...args: unknown[]) => endRunAction(...args),
}));

import { Runner } from "./runner";

const MAKE_3_OF_5: DrillScoring = {
  schema_version: 1,
  kind: "success_count",
  attempts_per_set: 5,
  pass_threshold: 3,
};

function version(scoring: DrillScoring): DrillVersionRead {
  return {
    id: "v1",
    version_number: 1,
    instructions: "I",
    layout: emptyForm().layout,
    scoring,
    created_at: "2026-10-16T10:00:00Z",
  };
}

function progress(scoring: DrillScoring, outcomes: ("success" | "fail" | "partial")[] = []): SetProgress {
  return computeSetProgress(
    scoring,
    outcomes.map((outcome) => ({ outcome, points: null, is_voided: false })),
  );
}

function run(scoring: DrillScoring, over: Partial<DrillRunRead> = {}): DrillRunRead {
  return {
    id: "r1",
    practice_session_id: "s1",
    drill_id: "d1",
    drill_version_id: "v1",
    run_number: 1,
    started_at: "2026-10-16T10:00:00Z",
    ended_at: null,
    notes: null,
    set_progress: progress(scoring),
    ...over,
  };
}

function summary(id: string, n: number, outcome: AttemptSummary["outcome"], voided = false): AttemptSummary {
  return {
    id,
    attempt_number: n,
    outcome,
    points: null,
    duration_ms: null,
    tapped_at: "2026-10-16T10:00:00Z",
    recorded_at: "2026-10-16T10:00:00Z",
    voided_at: voided ? "2026-10-16T10:01:00Z" : null,
    notes: null,
  };
}

function saved(id: string, n: number, set_progress: SetProgress): ApiResult<AttemptRead> {
  return { ok: true, data: { ...summary(id, n, "success"), drill_run_id: "r1", set_progress } };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderRunner(
  scoring: DrillScoring = MAKE_3_OF_5,
  props: { attempts?: AttemptSummary[]; run?: Partial<DrillRunRead>; sessionEndedAt?: string | null } = {},
) {
  return render(
    <Runner
      sessionId="s1"
      sessionStartedAt="2026-10-16T09:00:00Z"
      sessionEndedAt={props.sessionEndedAt ?? null}
      run={run(scoring, {
        ...props.run,
        // As the server would work it out: undone attempts do not count.
        set_progress: computeSetProgress(
          scoring,
          (props.attempts ?? []).map((a) => ({
            outcome: a.outcome,
            points: a.points,
            is_voided: a.voided_at !== null,
          })),
        ),
      })}
      drillTitle="30-degree cut"
      version={version(scoring)}
      initialAttempts={props.attempts ?? []}
    />,
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Runner", () => {
  it("shows the drill, its pinned version and rule, and what the set needs", () => {
    renderRunner();

    expect(text("runner-title")).toBe("30-degree cut");
    expect(text("runner-version")).toBe("v1");
    expect(text("runner-status")).toBe("3 more makes to pass");
    expect(text("runner-set")).toBe("Set 1");
    expect(text("runner-run-total")).toBe("Run total 0 of 0");
    expect(screen.getByTestId("runner-undo")).toBeDisabled();
    expect(screen.getByTestId("runner-outcome-success")).toBeEnabled();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-hydrated", "true");
  });

  it("updates the tally at once, then takes the server's progress", async () => {
    const user = userEvent.setup();
    const pending = deferred<ApiResult<AttemptRead>>();
    logAttemptAction.mockReturnValue(pending.promise);
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));

    // Before the server answers: counted, and drawn as being saved.
    expect(text("runner-made")).toBe("1");
    expect(text("runner-taken")).toBe("/1");
    expect(text("runner-last")).toBe("Attempt 1 · Make");
    expect(screen.getByTestId("rail-sight-0")).toHaveAttribute("data-mark", "pending");
    expect(screen.getByTestId("runner-undo")).toBeDisabled();

    // The server's own answer replaces the local count.
    const serverSays = { ...progress(MAKE_3_OF_5, ["success"]), successes: 2, attempts_in_set: 1 };
    pending.resolve(saved("a1", 1, serverSays));
    await waitFor(() => expect(text("runner-made")).toBe("2"));
    expect(screen.getByTestId("rail-sight-0")).toHaveAttribute("data-mark", "success");
    expect(screen.getByTestId("runner-undo")).toBeEnabled();
  });

  it("sends a fresh Idempotency-Key per tap, with the outcome and the tap time", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockResolvedValue(saved("a1", 1, progress(MAKE_3_OF_5, ["success"])));
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));
    await user.click(screen.getByTestId("runner-outcome-fail"));

    await waitFor(() => expect(logAttemptAction).toHaveBeenCalledTimes(2));
    const [first, second] = logAttemptAction.mock.calls;
    expect(first[0]).toBe("r1");
    expect(first[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first[1]).not.toBe(second[1]);
    expect(first[2]).toMatchObject({ outcome: "success" });
    expect(second[2]).toMatchObject({ outcome: "fail" });
    expect(Number.isNaN(Date.parse(first[2].tapped_at))).toBe(false);
  });

  it("counts taps made while an earlier one is still being saved", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockReturnValue(new Promise(() => {}));
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));
    await user.click(screen.getByTestId("runner-outcome-fail"));
    await user.click(screen.getByTestId("runner-outcome-partial"));

    expect(text("runner-taken")).toBe("/3");
    expect(text("runner-last")).toBe("Attempt 3 · Partial");
  });

  it("keeps a failed tap and retries it with the same key", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockResolvedValueOnce({ ok: false, error: "Could not reach the API" });
    logAttemptAction.mockResolvedValueOnce(saved("a1", 1, progress(MAKE_3_OF_5, ["success"])));
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));

    const alert = await screen.findByTestId("runner-error");
    expect(alert).toHaveTextContent("Couldn’t save attempt 1");
    // Still counted on screen, and new taps are held back so attempts stay in order.
    expect(text("runner-taken")).toBe("/1");
    expect(screen.getByTestId("runner-outcome-success")).toBeDisabled();
    expect(screen.getByTestId("runner-end")).toBeDisabled();

    await user.click(screen.getByTestId("runner-retry"));

    await waitFor(() => expect(screen.queryByTestId("runner-error")).toBeNull());
    expect(logAttemptAction).toHaveBeenCalledTimes(2);
    expect(logAttemptAction.mock.calls[1][1]).toBe(logAttemptAction.mock.calls[0][1]);
    expect(screen.getByTestId("runner-outcome-success")).toBeEnabled();
    expect(text("runner-taken")).toBe("/1");
  });

  it("treats a call that throws, with no connection, like a failed send and offers Retry", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockRejectedValueOnce(new Error("Failed to fetch"));
    logAttemptAction.mockResolvedValueOnce(saved("a1", 1, progress(MAKE_3_OF_5, ["success"])));
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));

    expect(await screen.findByTestId("runner-error")).toHaveTextContent("Couldn’t save attempt 1");
    expect(screen.getByTestId("rail-sight-0")).not.toHaveAttribute("data-mark", "pending");

    await user.click(screen.getByTestId("runner-retry"));

    await waitFor(() => expect(screen.queryByTestId("runner-error")).toBeNull());
    expect(logAttemptAction.mock.calls[1][1]).toBe(logAttemptAction.mock.calls[0][1]);
  });

  it("numbers a failed attempt without counting undone ones", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockRejectedValue(new Error("Failed to fetch"));
    renderRunner(MAKE_3_OF_5, {
      attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail", true), summary("a3", 3, "fail", true)],
    });

    await user.click(screen.getByTestId("runner-outcome-success"));

    expect(await screen.findByTestId("runner-error")).toHaveTextContent("Couldn’t save attempt 2");
  });

  it("puts an attempt back when an undo call throws, and says so", async () => {
    const user = userEvent.setup();
    voidAttemptAction.mockRejectedValue(new Error("Failed to fetch"));
    renderRunner(MAKE_3_OF_5, { attempts: [summary("a1", 1, "success")] });

    await user.click(screen.getByTestId("runner-undo"));

    expect(await screen.findByTestId("runner-message")).toHaveTextContent("Couldn’t undo");
    expect(text("runner-taken")).toBe("/1");
  });

  it("says so when ending the run throws", async () => {
    const user = userEvent.setup();
    endRunAction.mockRejectedValue(new Error("Failed to fetch"));
    renderRunner();

    await user.click(screen.getByTestId("runner-end"));

    expect(await screen.findByTestId("runner-message")).toHaveTextContent("Couldn’t end the run");
    expect(push).not.toHaveBeenCalled();
  });

  it("takes back a tap the server refused because the run had ended", async () => {
    const user = userEvent.setup();
    logAttemptAction.mockResolvedValue({ ok: false, code: "drill_run_ended", error: "Ended." });
    renderRunner();

    await user.click(screen.getByTestId("runner-outcome-success"));

    expect(await screen.findByTestId("runner-ended")).toBeInTheDocument();
    expect(text("runner-taken")).toBe("/0");
    expect(screen.getByTestId("runner-message")).toHaveTextContent("was not recorded");
    expect(screen.getByTestId("runner-outcome-success")).toBeDisabled();
    expect(screen.queryByTestId("runner-end")).toBeNull();
  });

  it("starts from the server's attempts, so a reload keeps the run", () => {
    renderRunner(MAKE_3_OF_5, {
      attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail"), summary("a3", 3, "success", true)],
    });

    expect(text("runner-made")).toBe("1");
    expect(text("runner-taken")).toBe("/2");
    expect(text("runner-last")).toBe("Attempt 2 · Miss");
    expect(screen.getByTestId("runner-undo")).toBeEnabled();
  });

  it("undoes the newest attempt at once and keeps the server's progress", async () => {
    const user = userEvent.setup();
    const pending = deferred<ApiResult<AttemptRead>>();
    voidAttemptAction.mockReturnValue(pending.promise);
    renderRunner(MAKE_3_OF_5, { attempts: [summary("a1", 1, "success"), summary("a2", 2, "fail")] });

    await user.click(screen.getByTestId("runner-undo"));

    expect(voidAttemptAction).toHaveBeenCalledWith("a2");
    expect(text("runner-taken")).toBe("/1");
    expect(text("runner-last")).toBe("Attempt 1 · Make");
    expect(screen.getByTestId("runner-undo")).toBeDisabled();

    pending.resolve(saved("a2", 2, progress(MAKE_3_OF_5, ["success"])));
    await waitFor(() => expect(screen.getByTestId("runner-undo")).toBeEnabled());
    expect(text("runner-taken")).toBe("/1");
  });

  it("puts the attempt back and says so when an undo fails", async () => {
    const user = userEvent.setup();
    voidAttemptAction.mockResolvedValue({ ok: false, error: "Could not reach the API" });
    renderRunner(MAKE_3_OF_5, { attempts: [summary("a1", 1, "success")] });

    await user.click(screen.getByTestId("runner-undo"));

    expect(await screen.findByTestId("runner-message")).toHaveTextContent("Couldn’t undo");
    expect(text("runner-taken")).toBe("/1");
  });

  it("ends the run and returns to the session", async () => {
    const user = userEvent.setup();
    endRunAction.mockResolvedValue({ ok: true, data: {} });
    renderRunner();

    await user.click(screen.getByTestId("runner-end"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/s1"));
    expect(endRunAction).toHaveBeenCalledWith("r1", "s1");
  });

  it("shows an ended run as read-only", () => {
    renderRunner(MAKE_3_OF_5, {
      attempts: [summary("a1", 1, "success")],
      run: { ended_at: "2026-10-16T10:30:00Z" },
    });

    expect(screen.getByTestId("runner-ended")).toBeInTheDocument();
    expect(screen.queryByTestId("runner-end")).toBeNull();
    expect(screen.getByTestId("runner-outcome-success")).toBeDisabled();
    expect(screen.getByTestId("runner-undo")).toBeDisabled();
  });

  it("shows the time since the session started, or its length once finished", () => {
    renderRunner(MAKE_3_OF_5, { sessionEndedAt: "2026-10-16T09:42:15Z" });

    expect(text("runner-session-time")).toBe("42:15");
    expect(screen.getByTestId("runner-ended")).toBeInTheDocument();
  });
});

describe("Runner, other scoring kinds", () => {
  it("logs points for a points drill, with no outcome sent", async () => {
    const user = userEvent.setup();
    const scoring: DrillScoring = {
      schema_version: 1,
      kind: "points",
      attempts_per_set: 3,
      max_points_per_attempt: 3,
      pass_threshold: 6,
    };
    logAttemptAction.mockResolvedValue(
      saved(
        "a1",
        1,
        computeSetProgress(scoring, [{ outcome: "partial", points: 2, is_voided: false }]),
      ),
    );
    renderRunner(scoring);
    expect(screen.queryByTestId("runner-outcome-success")).toBeNull();

    await user.click(screen.getByTestId("runner-points-2"));

    expect(text("runner-made")).toBe("2");
    expect(text("runner-taken")).toBe("/9");
    expect(text("runner-status")).toBe("4 more points to pass");
    const input = logAttemptAction.mock.calls[0][2];
    expect(input).toMatchObject({ points: 2 });
    expect(input).not.toHaveProperty("outcome");
  });

  it("needs the time before it logs an attempt on a timed drill", async () => {
    const user = userEvent.setup();
    const scoring: DrillScoring = {
      schema_version: 1,
      kind: "timed",
      attempts_per_set: 3,
      time_limit_seconds: 90,
      pass_threshold: 2,
    };
    logAttemptAction.mockResolvedValue(saved("a1", 1, progress(scoring, ["success"])));
    renderRunner(scoring);
    expect(screen.getByTestId("runner-outcome-success")).toBeDisabled();

    await user.type(screen.getByTestId("runner-seconds"), "12.5");
    expect(screen.getByTestId("runner-outcome-success")).toBeEnabled();
    await user.click(screen.getByTestId("runner-outcome-success"));

    expect(logAttemptAction.mock.calls[0][2]).toMatchObject({ outcome: "success", duration_ms: 12500 });
    // The field is cleared for the next attempt.
    expect(screen.getByTestId("runner-seconds")).toHaveValue("");
    expect(screen.getByTestId("runner-outcome-success")).toBeDisabled();
  });

  it("counts a streak for a streak drill", async () => {
    const user = userEvent.setup();
    const scoring: DrillScoring = { schema_version: 1, kind: "streak", streak_length: 3 };
    logAttemptAction.mockReturnValue(new Promise(() => {}));
    renderRunner(scoring);
    expect(text("runner-set")).toBe("Streak");

    await user.click(screen.getByTestId("runner-outcome-success"));
    await user.click(screen.getByTestId("runner-outcome-success"));

    expect(text("runner-made")).toBe("2");
    expect(text("runner-taken")).toBe("/3");
    expect(text("runner-status")).toBe("1 more in a row to reach 3");
    const pips = within(screen.getByTestId("runner-pips"));
    expect(pips.getByTestId("rail-sight-2")).toHaveAttribute("data-mark", "empty");
  });
});
