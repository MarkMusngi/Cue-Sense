// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DrillRead } from "@/lib/api-client";
import { emptyForm } from "@/lib/drill-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const startSessionAction = vi.fn();
const finishSessionAction = vi.fn();
const startDrillRunAction = vi.fn();
const startRunInSessionAction = vi.fn();
vi.mock("@/app/(app)/sessions/actions", () => ({
  startSessionAction: (...args: unknown[]) => startSessionAction(...args),
  finishSessionAction: (...args: unknown[]) => finishSessionAction(...args),
  startDrillRunAction: (...args: unknown[]) => startDrillRunAction(...args),
  startRunInSessionAction: (...args: unknown[]) => startRunInSessionAction(...args),
}));

import { DrillPicker } from "./drill-picker";
import { LocalTime } from "./local-time";
import { FinishSessionButton, StartRunButton, StartSessionButton } from "./session-buttons";

function drill(id: string, title: string, status: DrillRead["status"] = "active"): DrillRead {
  return {
    id,
    title,
    slug: id,
    description: null,
    difficulty: 2,
    status,
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-04T10:00:00Z",
    tags: [],
    current_version: {
      id: `${id}-v1`,
      version_number: 1,
      instructions: "I",
      layout: emptyForm().layout,
      scoring: { schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 6 },
      created_at: "2026-10-04T10:00:00Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StartRunButton", () => {
  it("starts the run and opens the runner", async () => {
    const user = userEvent.setup();
    startDrillRunAction.mockResolvedValue({ ok: true, data: { session_id: "s1", run_id: "r1" } });
    render(<StartRunButton drill={drill("d1", "Stop shot")} />);

    await user.click(screen.getByTestId("drill-detail-start-run"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/s1/runs/r1"));
    expect(startDrillRunAction).toHaveBeenCalledWith("d1");
  });

  it("cannot start an archived drill, and says why", () => {
    render(<StartRunButton drill={drill("d1", "Stop shot", "archived")} />);

    expect(screen.getByTestId("drill-detail-start-run")).toBeDisabled();
    expect(screen.getByTestId("drill-detail-start-run-hint")).toHaveTextContent("Unarchive it first");
  });

  it("shows the API's reason when the run cannot start", async () => {
    const user = userEvent.setup();
    startDrillRunAction.mockResolvedValue({ ok: false, code: "drill_archived", error: "That drill is archived." });
    render(<StartRunButton drill={drill("d1", "Stop shot")} />);

    await user.click(screen.getByTestId("drill-detail-start-run"));

    expect(await screen.findByTestId("session-action-error")).toHaveTextContent("archived");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("StartSessionButton and FinishSessionButton", () => {
  it("starts a session and opens it", async () => {
    const user = userEvent.setup();
    startSessionAction.mockResolvedValue({ ok: true, data: { id: "s9" } });
    render(<StartSessionButton />);

    await user.click(screen.getByTestId("session-start"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/s9"));
  });

  it("finishes a session and refreshes the page", async () => {
    const user = userEvent.setup();
    finishSessionAction.mockResolvedValue({ ok: true, data: {} });
    render(<FinishSessionButton sessionId="s1" />);

    await user.click(screen.getByTestId("session-finish"));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(finishSessionAction).toHaveBeenCalledWith("s1");
  });

  it("shows an error when finishing fails", async () => {
    const user = userEvent.setup();
    finishSessionAction.mockResolvedValue({ ok: false, error: "Could not reach the API" });
    render(<FinishSessionButton sessionId="s1" />);

    await user.click(screen.getByTestId("session-finish"));

    expect(await screen.findByTestId("session-action-error")).toHaveTextContent("Could not reach");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("DrillPicker", () => {
  const drills = [drill("d1", "Stop shot"), drill("d2", "30-degree cut"), drill("d3", "Old drill", "archived")];

  it("lists the drills that can be started, leaving out archived ones", () => {
    render(<DrillPicker sessionId="s1" drills={drills} />);

    expect(screen.getByTestId("drill-picker-start-d1")).toBeInTheDocument();
    expect(screen.getByTestId("drill-picker-start-d2")).toBeInTheDocument();
    expect(screen.queryByTestId("drill-picker-start-d3")).toBeNull();
  });

  it("filters by title", async () => {
    const user = userEvent.setup();
    render(<DrillPicker sessionId="s1" drills={drills} />);

    await user.type(screen.getByTestId("drill-picker-search"), "CUT");

    expect(screen.queryByTestId("drill-picker-start-d1")).toBeNull();
    expect(screen.getByTestId("drill-picker-start-d2")).toBeInTheDocument();

    await user.clear(screen.getByTestId("drill-picker-search"));
    await user.type(screen.getByTestId("drill-picker-search"), "zzz");
    expect(screen.getByTestId("drill-picker-none")).toHaveTextContent("No drill matches");
  });

  it("starts a drill run in this session and opens the runner", async () => {
    const user = userEvent.setup();
    startRunInSessionAction.mockResolvedValue({ ok: true, data: { session_id: "s1", run_id: "r7" } });
    render(<DrillPicker sessionId="s1" drills={drills} />);

    await user.click(screen.getByTestId("drill-picker-start-d2"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sessions/s1/runs/r7"));
    expect(startRunInSessionAction).toHaveBeenCalledWith("s1", "d2");
  });

  it("shows the API's reason and lets the person try again", async () => {
    const user = userEvent.setup();
    startRunInSessionAction.mockResolvedValue({ ok: false, code: "session_ended", error: "That session has ended." });
    render(<DrillPicker sessionId="s1" drills={drills} />);

    await user.click(screen.getByTestId("drill-picker-start-d1"));

    expect(await screen.findByTestId("drill-picker-error")).toHaveTextContent("has ended");
    expect(screen.getByTestId("drill-picker-start-d1")).toBeEnabled();
  });

  it("explains an empty list", () => {
    render(<DrillPicker sessionId="s1" drills={[drill("d3", "Old drill", "archived")]} />);
    expect(screen.getByTestId("drill-picker-empty")).toBeInTheDocument();
  });
});

describe("LocalTime", () => {
  it("renders a time element for the instant, with a day shown", () => {
    render(<LocalTime iso="2026-10-16T22:30:00Z" />);

    const time = screen.getByText(/Oct/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-16T22:30:00Z");
  });
});
