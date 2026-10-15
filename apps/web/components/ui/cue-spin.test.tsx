// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CueSpin } from "@/components/ui/cue-spin";

describe("CueSpin", () => {
  it("describes the hit point and places the dot on the face", () => {
    render(<CueSpin spin={{ x: 0, y: -0.8 }} />);

    expect(screen.getByRole("img", { name: "Cue spin: Below center (draw)" })).toBeInTheDocument();
    const dot = screen.getByTestId("cue-spin-dot");
    expect(Number(dot.getAttribute("cx"))).toBeCloseTo(0, 5);
    // SVG y grows downwards, so a point below center has a positive cy.
    expect(Number(dot.getAttribute("cy"))).toBeGreaterThan(0);
  });

  it("shows center ball when there is no spin", () => {
    render(<CueSpin />);

    expect(screen.getByRole("img", { name: "Cue spin: Center ball" })).toBeInTheDocument();
  });
});
