// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";

describe("AuthForm", () => {
  it("labels the fields and links to the other form", () => {
    render(<AuthForm mode="sign-in" action={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByTestId("auth-switch-link")).toHaveAttribute("href", "/sign-up");
  });

  it("asks sign-up passwords for 8 characters", () => {
    render(<AuthForm mode="sign-up" action={vi.fn()} />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
    expect(screen.getByTestId("auth-switch-link")).toHaveAttribute("href", "/sign-in");
  });

  it("submits the entered values to the action and shows its error", async () => {
    const action = vi.fn().mockResolvedValue({ error: "The email or password is wrong." });
    render(<AuthForm mode="sign-in" action={action} />);

    await userEvent.type(screen.getByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret-secret");
    await userEvent.click(screen.getByTestId("auth-submit"));

    const data = action.mock.calls[0][1] as FormData;
    expect(data.get("email")).toBe("a@example.test");
    expect(data.get("password")).toBe("secret-secret");
    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password is wrong.");
  });

  it("shows a field error beside its field", async () => {
    const action = vi.fn().mockResolvedValue({ field_errors: { password: "Too short." } });
    render(<AuthForm mode="sign-up" action={action} />);

    await userEvent.type(screen.getByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "12345678");
    await userEvent.click(screen.getByTestId("auth-submit"));

    expect(await screen.findByTestId("auth-password-error")).toHaveTextContent("Too short.");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });
});
