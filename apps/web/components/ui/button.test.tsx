// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("is a plain button with a default test id", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start drill run</Button>);

    const button = screen.getByRole("button", { name: "Start drill run" });
    await userEvent.click(button);

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-testid", "button");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("takes a caller's test id and can be disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button data-testid="save-drill" disabled onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByTestId("save-drill"));

    expect(screen.getByTestId("save-drill")).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
