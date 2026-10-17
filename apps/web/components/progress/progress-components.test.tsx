// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { DrillSelect } from "@/components/progress/drill-select";
import { RangeToggle } from "@/components/progress/range-toggle";
import { SuccessChart } from "@/components/progress/success-chart";
import { TagTable } from "@/components/progress/tag-table";
import { VolumeBars } from "@/components/progress/volume-bars";
import type { SuccessRateStats } from "@/lib/api-client";

beforeEach(() => vi.clearAllMocks());

const STATS: SuccessRateStats = {
  drill_id: "d1",
  bucket: "week",
  from: "2026-10-01",
  to: "2026-10-31",
  points: [
    { bucket_start: "2026-10-05", attempts: 3, successes: 1, success_rate: 0.3333, drill_run_count: 1, drill_version_numbers: [1] },
    { bucket_start: "2026-10-12", attempts: 20, successes: 14, success_rate: 0.7, drill_run_count: 2, drill_version_numbers: [1, 2] },
  ],
  versions: [
    { drill_version_id: "a", version_number: 1, scoring_kind: "success_count", first_attempt_at: "x", scoring_kind_changed: false },
    { drill_version_id: "b", version_number: 2, scoring_kind: "timed", first_attempt_at: "x", scoring_kind_changed: true },
  ],
};

describe("SuccessChart", () => {
  it("describes the trend for screen readers and lists the data in a table", () => {
    render(<SuccessChart stats={STATS} title="Stop shot" />);

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Success rate for Stop shot: 33% on 5 Oct to 70% on 12 Oct, over 2 weeks with attempts",
    );
    const rows = within(screen.getByTestId("success-chart-table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("12 Oct207");
  });

  it("marks the new version and says when scoring changed", () => {
    render(<SuccessChart stats={STATS} title="Stop shot" />);

    expect(screen.getByTestId("version-boundary-2")).toHaveTextContent("v2 · scoring changed");
    expect(screen.getByTestId("scoring-changed-note")).toHaveTextContent("not comparable");
  });

  it("fades points with few attempts and explains why", () => {
    render(<SuccessChart stats={STATS} title="Stop shot" />);

    const points = screen.getAllByTestId("success-chart-point");
    expect(points[0]).toHaveAttribute("data-few", "true");
    expect(points[1]).not.toHaveAttribute("data-few");
    expect(screen.getByTestId("few-attempts-note")).toHaveTextContent("fewer than 5 attempts");
  });

  it("shows one point without a line, and no notes when nothing needs saying", () => {
    const single: SuccessRateStats = {
      ...STATS,
      points: [STATS.points[1]],
      versions: [STATS.versions[0]],
    };
    const { container } = render(<SuccessChart stats={single} title="Stop shot" />);

    expect(container.querySelector("polyline")).toBeNull();
    expect(screen.queryByTestId("few-attempts-note")).toBeNull();
    expect(screen.queryByTestId("scoring-changed-note")).toBeNull();
  });
});

describe("VolumeBars", () => {
  const items = [
    { week_start: "2026-10-05", practice_sessions: 0, drill_runs: 0, attempts: 0 },
    { week_start: "2026-10-12", practice_sessions: 2, drill_runs: 3, attempts: 40 },
    { week_start: "2026-10-19", practice_sessions: 1, drill_runs: 1, attempts: 20 },
  ];

  it("draws one bar per week and labels them all", () => {
    render(<VolumeBars items={items} />);

    expect(screen.getAllByTestId("volume-bar")).toHaveLength(3);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Attempts per week: 5 Oct, 0; 12 Oct, 40; 19 Oct, 20",
    );
  });

  it("makes the busiest week the tallest, and an empty week a stub", () => {
    render(<VolumeBars items={items} />);

    const [empty, busy, half] = screen.getAllByTestId("volume-bar");
    expect(empty.style.height).toBe("3px");
    expect(busy.style.height).toBe("72px");
    expect(half.style.height).toBe("36px");
  });
});

describe("TagTable", () => {
  it("lists each tag with its attempts and rate", () => {
    render(
      <TagTable
        items={[
          { tag_id: "t1", name: "Cut shots", category: "skill", drill_count: 2, drill_run_count: 3, attempts: 160, successes: 97, success_rate: 0.6063 },
        ]}
      />,
    );

    const row = screen.getByTestId("tag-row");
    expect(row).toHaveTextContent("Cut shots");
    expect(row).toHaveTextContent("160");
    expect(row).toHaveTextContent("61%");
    expect(screen.getByRole("columnheader", { name: "Success" })).toBeInTheDocument();
  });
});

describe("RangeToggle", () => {
  it("links each range, keeps the drill and marks the current range", () => {
    render(<RangeToggle range={30} drill="d1" />);

    expect(screen.getByTestId("progress-range-7")).toHaveAttribute("href", "/progress?range=7&drill=d1");
    expect(screen.getByTestId("progress-range-30")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("progress-range-90")).not.toHaveAttribute("aria-current");
  });
});

describe("DrillSelect", () => {
  it("changes the URL, keeping the range", async () => {
    render(
      <DrillSelect
        drills={[
          { id: "d1", title: "Stop shot" },
          { id: "d2", title: "Cut" },
        ]}
        selected="d1"
        range={90}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Drill"), "d2");

    expect(replace).toHaveBeenCalledWith("/progress?range=90&drill=d2");
  });
});
