// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OutcomeButton } from "@/components/ui/outcome-button";

describe("OutcomeButton", () => {
  it.each([
    ["success", "Make"],
    ["fail", "Miss"],
    ["partial", "Partial"],
  ] as const)("%s reads %s and has its own test id", async (outcome, label) => {
    const onClick = vi.fn();
    render(<OutcomeButton outcome={outcome} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(screen.getByTestId(`outcome-${outcome}`)).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
