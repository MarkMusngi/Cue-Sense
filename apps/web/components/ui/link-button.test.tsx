// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buttonClasses } from "./button-styles";
import { LinkButton } from "./link-button";
import { TextArea } from "./text-area";

describe("LinkButton", () => {
  it("is a link that looks like a button", () => {
    render(
      <LinkButton href="/drills/new" variant="primary" data-testid="drill-new">
        New drill
      </LinkButton>,
    );

    const link = screen.getByRole("link", { name: "New drill" });
    expect(link).toHaveAttribute("href", "/drills/new");
    expect(link).toHaveAttribute("data-testid", "drill-new");
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("bg-chalk");
  });
});

describe("buttonClasses", () => {
  it("is at least 44 px tall and adds the caller's classes", () => {
    expect(buttonClasses("ghost", "ml-auto")).toContain("min-h-11");
    expect(buttonClasses("ghost", "ml-auto")).toContain("ml-auto");
    expect(buttonClasses()).toContain("border-control");
  });
});

describe("TextArea", () => {
  it("ties its label, hint and error to the box", async () => {
    const user = userEvent.setup();
    render(
      <TextArea label="Instructions" hint="What to do" error="Enter instructions." data-testid="notes" />,
    );

    const box = screen.getByLabelText("Instructions");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("What to do Enter instructions.");
    expect(screen.getByTestId("notes-error")).toHaveTextContent("Enter instructions.");

    await user.type(box, "Roll back");
    expect(box).toHaveValue("Roll back");
  });

  it("has no error styling without an error", () => {
    render(<TextArea label="Notes" />);
    expect(screen.getByLabelText("Notes")).not.toHaveAttribute("aria-invalid");
  });
});
