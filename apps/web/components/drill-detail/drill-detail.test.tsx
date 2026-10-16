// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DrillRead, DrillVersionRead } from "@/lib/api-client";
import { emptyForm } from "@/lib/drill-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const duplicateDrillAction = vi.fn();
const changeStatusAction = vi.fn();
vi.mock("@/app/(app)/drills/actions", () => ({
  duplicateDrillAction: (...args: unknown[]) => duplicateDrillAction(...args),
  changeStatusAction: (...args: unknown[]) => changeStatusAction(...args),
}));

import { DrillActions } from "./drill-actions";
import { ScoringSummary } from "./scoring-summary";
import { formatVersionDate, VersionList } from "./version-list";

function version(n: number, created_at: string): DrillVersionRead {
  return {
    id: `v${n}`,
    version_number: n,
    instructions: "I",
    layout: emptyForm().layout,
    scoring: { schema_version: 1, kind: "streak", streak_length: 5 },
    created_at,
  };
}

function drill(status: DrillRead["status"]): DrillRead {
  return {
    id: "d1",
    title: "T",
    slug: "t",
    description: null,
    difficulty: 3,
    status,
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
    tags: [],
    current_version: version(1, "2026-10-04T10:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VersionList", () => {
  const versions = [
    version(1, "2026-10-04T10:00:00Z"),
    version(3, "2026-10-14T10:00:00Z"),
    version(2, "2026-10-12T10:00:00Z"),
  ];

  it("lists the newest version first and marks the current one", () => {
    render(<VersionList versions={versions} currentVersionId="v3" />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual([
      "drill-detail-version-3",
      "drill-detail-version-2",
      "drill-detail-version-1",
    ]);
    expect(items[0]).toHaveTextContent("v3");
    expect(items[0]).toHaveTextContent("14 Oct");
    expect(items[0]).toHaveTextContent("current");
    expect(items[1]).not.toHaveTextContent("current");
    expect(items[2]).toHaveTextContent("Created");
    expect(screen.getByText("Each drill run keeps the version it started with.")).toBeInTheDocument();
  });

  it("adds the year to a date that is not in the current year", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    expect(formatVersionDate("2026-10-04T10:00:00Z", now)).toBe("4 Oct");
    expect(formatVersionDate("2025-12-31T23:00:00Z", now)).toBe("31 Dec 2025");
    expect(formatVersionDate("not a date", now)).toBe("");
  });
});

describe("ScoringSummary", () => {
  it("shows the headline rule and its detail", () => {
    render(
      <ScoringSummary
        scoring={{ schema_version: 1, kind: "success_count", attempts_per_set: 10, pass_threshold: 6 }}
      />,
    );
    expect(screen.getByTestId("drill-detail-scoring")).toHaveTextContent(
      "Make 6 of 10per set of 10 attempts",
    );
  });
});

describe("DrillActions", () => {
  it("links to the editor and offers Activate and Archive for a draft", () => {
    render(<DrillActions drill={drill("draft")} />);

    expect(screen.getByTestId("drill-detail-edit")).toHaveAttribute("href", "/drills/d1/edit");
    expect(screen.getByTestId("drill-detail-activate")).toBeInTheDocument();
    expect(screen.getByTestId("drill-detail-archive")).toBeInTheDocument();
    expect(screen.queryByTestId("drill-detail-unarchive")).toBeNull();
  });

  it("offers only Archive for an active drill", () => {
    render(<DrillActions drill={drill("active")} />);

    expect(screen.getByTestId("drill-detail-archive")).toBeInTheDocument();
    expect(screen.queryByTestId("drill-detail-activate")).toBeNull();
    expect(screen.queryByTestId("drill-detail-unarchive")).toBeNull();
  });

  it("offers Unarchive, not Archive, for an archived drill", () => {
    render(<DrillActions drill={drill("archived")} />);

    expect(screen.getByTestId("drill-detail-unarchive")).toBeInTheDocument();
    expect(screen.queryByTestId("drill-detail-archive")).toBeNull();
  });

  it("changes the status and refreshes the page", async () => {
    const user = userEvent.setup();
    changeStatusAction.mockResolvedValue({ ok: true, data: drill("archived") });
    render(<DrillActions drill={drill("active")} />);

    await user.click(screen.getByTestId("drill-detail-archive"));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(changeStatusAction).toHaveBeenCalledWith("d1", "archived");
  });

  it("unarchives to active", async () => {
    const user = userEvent.setup();
    changeStatusAction.mockResolvedValue({ ok: true, data: drill("active") });
    render(<DrillActions drill={drill("archived")} />);

    await user.click(screen.getByTestId("drill-detail-unarchive"));

    await waitFor(() => expect(changeStatusAction).toHaveBeenCalledWith("d1", "active"));
  });

  it("duplicates and opens the copy", async () => {
    const user = userEvent.setup();
    duplicateDrillAction.mockResolvedValue({ ok: true, data: { ...drill("draft"), id: "copy-id" } });
    render(<DrillActions drill={drill("active")} />);

    await user.click(screen.getByTestId("drill-detail-duplicate"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/drills/copy-id"));
    expect(duplicateDrillAction).toHaveBeenCalledWith("d1");
  });

  it("shows the API's message when an action fails", async () => {
    const user = userEvent.setup();
    changeStatusAction.mockResolvedValue({
      ok: false,
      code: "invalid_status_transition",
      error: "A draft drill cannot become draft.",
    });
    render(<DrillActions drill={drill("draft")} />);

    await user.click(screen.getByTestId("drill-detail-activate"));

    expect(await screen.findByTestId("drill-actions-error")).toHaveTextContent("cannot become");
    expect(refresh).not.toHaveBeenCalled();
  });
});
