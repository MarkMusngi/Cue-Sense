// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "@/components/ui/chip";

describe("Chip", () => {
  it("reports whether it is pressed", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip pressed={false} onClick={onClick}>
        Drafts
      </Chip>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Drafts" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByTestId("chip")).toHaveAttribute("aria-pressed", "false");

    rerender(
      <Chip pressed onClick={onClick}>
        Drafts
      </Chip>,
    );
    expect(screen.getByTestId("chip")).toHaveAttribute("aria-pressed", "true");
  });
});
