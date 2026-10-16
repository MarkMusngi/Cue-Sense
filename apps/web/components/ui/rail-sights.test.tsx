// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RailSights } from "@/components/ui/rail-sights";

describe("RailSights", () => {
  it("draws one sight per mark and describes them", () => {
    render(<RailSights marks={["success", "fail", "partial", "pending", "empty"]} />);

    const group = screen.getByRole("img", {
      name: "Set progress: 1 made, 1 missed, 1 partial, 1 being saved, 1 to go",
    });
    expect(group).toHaveAttribute("data-testid", "rail-sights");
    expect(screen.getAllByTestId(/^rail-sight-\d+$/)).toHaveLength(5);
    expect(screen.getByTestId("rail-sight-1")).toHaveAttribute("data-mark", "fail");
  });
});
