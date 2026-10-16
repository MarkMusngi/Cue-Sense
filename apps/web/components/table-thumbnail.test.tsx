// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DrillLayout } from "@/lib/api-client";

import { ballNumber, TableThumbnail } from "./table-thumbnail";

const LAYOUT: DrillLayout = {
  schema_version: 2,
  table: { kind: "pool", size_ft: 9 },
  cue_ball: { id: "ball_0", x: 2, y: 2 },
  object_balls: [{ id: "ball_1", x: 5.5, y: 1.2 }],
  landing_zone: { x: 3, y: 2 },
  cue_spin: { x: 0, y: -0.4 },
  target_pocket: "top_right",
};

describe("TableThumbnail", () => {
  it("draws a v2 layout with a target pocket and a landing zone", () => {
    render(<TableThumbnail layout={LAYOUT} label="Straight-in" />);

    const svg = screen.getByTestId("table-thumbnail");
    expect(svg).toHaveAttribute("aria-label", "Straight-in");
    // Felt rails (3 rects), pocket ring, landing zone, one object ball and the cue ball.
    expect(svg.querySelectorAll("circle")).toHaveLength(4);
  });

  it("draws a layout with no optional parts", () => {
    const bare: DrillLayout = {
      schema_version: 2,
      table: { kind: "pool", size_ft: 9 },
      cue_ball: { id: "ball_0", x: 2, y: 2 },
      object_balls: [],
    };

    render(<TableThumbnail layout={bare} label="Bare" />);

    expect(screen.getByTestId("table-thumbnail").querySelectorAll("circle")).toHaveLength(1);
  });
});

describe("ballNumber", () => {
  it("reads the number from a ball id", () => {
    expect(ballNumber("ball_3")).toBe(3);
    expect(ballNumber("cue")).toBeNull();
  });
});
