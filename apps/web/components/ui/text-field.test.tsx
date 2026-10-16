// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextField } from "@/components/ui/text-field";

describe("TextField", () => {
  it("labels its input", () => {
    render(<TextField label="Title" defaultValue="30-degree cut" data-testid="drill-title" />);

    expect(screen.getByLabelText("Title")).toHaveValue("30-degree cut");
    expect(screen.getByTestId("drill-title")).not.toHaveAttribute("aria-invalid");
  });

  it("ties an error to the input", () => {
    render(
      <TextField
        label="Makes to pass"
        defaultValue="11"
        error="At most 10, the attempts per set."
        data-testid="pass-threshold"
      />,
    );

    const input = screen.getByLabelText("Makes to pass");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("At most 10, the attempts per set.");
    expect(screen.getByTestId("pass-threshold-error")).toHaveTextContent(
      "At most 10, the attempts per set.",
    );
  });

  it("ties a hint to the input", () => {
    render(<TextField label="Attempts per set" hint="1 to 50" data-testid="attempts" />);

    expect(screen.getByLabelText("Attempts per set")).toHaveAccessibleDescription("1 to 50");
  });
});
