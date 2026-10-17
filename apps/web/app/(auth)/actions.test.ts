import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, redirect, client } = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), delete: vi.fn() },
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
  client: { signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api-client", () => client);

import { signInAction, signOutAction, signUpAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

function form(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

const SIGNED_IN = {
  ok: true,
  data: { user: { id: "u1", email: "a@example.test" }, session: { value: "tok", max_age: 100 } },
};

describe("sign in and sign up actions", () => {
  it("copies the session cookie onto the response and goes to the app", async () => {
    client.signIn.mockResolvedValue(SIGNED_IN);

    await expect(signInAction({}, form(" a@example.test ", "pw-pw-pw-pw"))).rejects.toThrow(
      "NEXT_REDIRECT /",
    );

    expect(client.signIn).toHaveBeenCalledWith("a@example.test", "pw-pw-pw-pw");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "cue_session",
      "tok",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 100, secure: false }),
    );
  });

  it("signs up the same way", async () => {
    client.signUp.mockResolvedValue(SIGNED_IN);

    await expect(signUpAction({}, form("a@example.test", "pw-pw-pw-pw"))).rejects.toThrow(
      "NEXT_REDIRECT /",
    );

    expect(client.signUp).toHaveBeenCalledWith("a@example.test", "pw-pw-pw-pw");
    expect(cookieStore.set).toHaveBeenCalled();
  });

  it("returns the message for a failed sign in and sets no cookie", async () => {
    client.signIn.mockResolvedValue({
      ok: false,
      code: "invalid_credentials",
      error: "The email or password is wrong.",
    });

    const state = await signInAction({}, form("a@example.test", "wrong-password"));

    expect(state).toEqual({ error: "The email or password is wrong." });
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("puts validation problems on the fields they belong to", async () => {
    client.signUp.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      error: "The request is invalid.",
      details: [
        { code: "schema_invalid", message: "Enter a valid email address.", path: ["email"] },
        { code: "schema_invalid", message: "Too short.", path: ["password"] },
      ],
    });

    const state = await signUpAction({}, form("nope", "short"));

    expect(state).toEqual({
      field_errors: { email: "Enter a valid email address.", password: "Too short." },
    });
  });
});

describe("signOutAction", () => {
  it("ends the session, clears the cookie and goes to sign in", async () => {
    client.signOut.mockResolvedValue({ ok: true, data: undefined });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT /sign-in");

    expect(client.signOut).toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("cue_session");
  });
});
