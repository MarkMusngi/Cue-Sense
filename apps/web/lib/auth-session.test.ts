import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSessionCookie, sessionCookieHeader } from "@/lib/auth-session";

describe("parseSessionCookie", () => {
  it("reads the value and Max-Age", () => {
    const header = "cue_session=abc-123_X; HttpOnly; Max-Age=2592000; Path=/; SameSite=lax";

    expect(parseSessionCookie([header])).toEqual({ value: "abc-123_X", max_age: 2592000 });
  });

  it("finds the cookie among other Set-Cookie headers", () => {
    expect(parseSessionCookie(["other=1; Path=/", "cue_session=tok; Path=/"])).toEqual({
      value: "tok",
      max_age: null,
    });
  });

  it("returns null when there is no session cookie", () => {
    expect(parseSessionCookie([])).toBeNull();
    expect(parseSessionCookie(["other=1"])).toBeNull();
  });

  it("treats an emptied cookie (the API clearing it) as no session", () => {
    expect(parseSessionCookie(["cue_session=; Max-Age=0; Path=/"])).toBeNull();
  });
});

describe("sessionCookieHeader", () => {
  afterEach(() => {
    vi.doUnmock("next/headers");
    vi.resetModules();
  });

  it("is undefined outside a request", async () => {
    expect(await sessionCookieHeader()).toBeUndefined();
  });

  it("sends the session cookie the browser holds", async () => {
    vi.doMock("next/headers", () => ({
      cookies: async () => ({
        get: (name: string) => (name === "cue_session" ? { value: "tok" } : undefined),
      }),
    }));
    const { sessionCookieHeader: header } = await import("@/lib/auth-session");

    expect(await header()).toBe("cue_session=tok");
  });

  it("is undefined when the browser has no session cookie", async () => {
    vi.doMock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
    const { sessionCookieHeader: header } = await import("@/lib/auth-session");

    expect(await header()).toBeUndefined();
  });
});
