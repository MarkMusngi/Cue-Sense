// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/sessions/today" }));

describe("AppShell", () => {
  it("renders the page inside a main landmark", () => {
    render(<AppShell>Drill list</AppShell>);

    expect(screen.getByRole("main")).toHaveTextContent("Drill list");
  });

  it("lets keyboard users skip straight to the page", () => {
    render(<AppShell>Page</AppShell>);

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it.each(["app-sidebar", "app-tab-bar"])("%s links to every section and marks the current one", (id) => {
    render(<AppShell>Page</AppShell>);

    const nav = within(screen.getByTestId(id));
    expect(nav.getByRole("link", { name: "Drills" })).toHaveAttribute("href", "/drills");
    expect(nav.getByRole("link", { name: "Progress" })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: "Sessions" })).toHaveAttribute("aria-current", "page");
  });
});
