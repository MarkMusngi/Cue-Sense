// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/ui/segmented-control";

describe("SegmentedControl", () => {
  const options = [
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "all", label: "All" },
  ];

  it("marks the chosen option and reports a new choice", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl label="Time range" options={options} value="30d" onChange={onChange} />,
    );

    expect(screen.getByRole("group", { name: "Time range" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "90 days" }));

    expect(onChange).toHaveBeenCalledWith("90d");
    expect(screen.getByTestId("segmented-control-90d")).toBeInTheDocument();
  });
});
