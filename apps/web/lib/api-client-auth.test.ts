import { afterEach, describe, expect, it, vi } from "vitest";

const { sessionCookieHeader } = vi.hoisted(() => ({ sessionCookieHeader: vi.fn() }));
vi.mock("@/lib/auth-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-session")>()),
  sessionCookieHeader,
}));

import { getDrills, getMe, signIn, signOut, signUp } from "@/lib/api-client";

function respond(status: number, body: unknown, headers: [string, string][] = []) {
  const response = new Response(body === undefined ? null : JSON.stringify(body), { status });
  for (const [name, value] of headers) response.headers.append(name, value);
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the session cookie on API calls", () => {
  it("is sent when the browser has one", async () => {
    sessionCookieHeader.mockResolvedValue("cue_session=tok");
    const fetchMock = respond(200, { items: [], total: 0, limit: 100, offset: 0 });

    await getDrills();

    expect(lastRequest(fetchMock).init.headers).toEqual({ Cookie: "cue_session=tok" });
  });

  it("is left out when there is none", async () => {
    sessionCookieHeader.mockResolvedValue(undefined);
    const fetchMock = respond(200, { items: [], total: 0, limit: 100, offset: 0 });

    await getDrills();

    expect(lastRequest(fetchMock).init.headers).toBeUndefined();
  });

  it("comes back as code unauthenticated on a 401", async () => {
    sessionCookieHeader.mockResolvedValue("cue_session=old");
    respond(401, { error: { code: "unauthenticated", message: "Sign in to continue.", details: [] } });

    const result = await getMe();

    expect(result).toEqual({ ok: false, code: "unauthenticated", error: "Sign in to continue." });
  });
});

describe("sign in, sign up and sign out", () => {
  const USER = { id: "u1", email: "a@example.test", created_at: "2026-10-17T00:00:00Z" };
  const COOKIE: [string, string] = ["set-cookie", "cue_session=tok; HttpOnly; Max-Age=60; Path=/"];

  it("signs in and returns the session cookie the API set", async () => {
    sessionCookieHeader.mockResolvedValue(undefined);
    const fetchMock = respond(201, USER, [COOKIE]);

    const result = await signIn("a@example.test", "pw-pw-pw-pw");

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/login-sessions$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@example.test", password: "pw-pw-pw-pw" });
    expect(result).toEqual({ ok: true, data: { user: USER, session: { value: "tok", max_age: 60 } } });
  });

  it("signs up through POST /users", async () => {
    sessionCookieHeader.mockResolvedValue(undefined);
    const fetchMock = respond(201, USER, [COOKIE]);

    await signUp("a@example.test", "pw-pw-pw-pw");

    expect(lastRequest(fetchMock).url).toMatch(/\/users$/);
  });

  it("fails if the API answers without a session cookie", async () => {
    sessionCookieHeader.mockResolvedValue(undefined);
    respond(201, USER);

    const result = await signIn("a@example.test", "pw-pw-pw-pw");

    expect(result.ok).toBe(false);
  });

  it("passes a rejected sign in on", async () => {
    sessionCookieHeader.mockResolvedValue(undefined);
    respond(401, { error: { code: "invalid_credentials", message: "The email or password is wrong.", details: [] } });

    const result = await signIn("a@example.test", "wrong-password");

    expect(result).toMatchObject({ ok: false, code: "invalid_credentials" });
  });

  it("signs out with DELETE /login-sessions/current", async () => {
    sessionCookieHeader.mockResolvedValue("cue_session=tok");
    const fetchMock = respond(204, undefined);

    const result = await signOut();

    const { url, init } = lastRequest(fetchMock);
    expect(url).toMatch(/\/login-sessions\/current$/);
    expect(init.method).toBe("DELETE");
    expect(result.ok).toBe(true);
  });
});
