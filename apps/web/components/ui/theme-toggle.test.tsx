// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/ui/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("switches from dark to light and remembers the choice", async () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);

    await userEvent.click(await screen.findByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("cue-sense-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("switches from light to dark", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    await userEvent.click(await screen.findByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("cue-sense-theme")).toBe("dark");
  });

  it("keeps every toggle on the page in step", async () => {
    document.documentElement.dataset.theme = "dark";
    render(
      <>
        <ThemeToggle data-testid="first" />
        <ThemeToggle data-testid="second" />
      </>,
    );

    await userEvent.click(await screen.findByTestId("first"));

    expect(await screen.findByTestId("second")).toHaveAccessibleName("Switch to dark theme");
  });
});
