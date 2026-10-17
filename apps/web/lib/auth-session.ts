// The session cookie. The API sets it (docs/authentication.md); the browser only talks to
// this Next.js server, so the server copies it onto its own response after sign in and
// sends it back to the API on every call.

export const SESSION_COOKIE = "cue_session";

export type SessionCookie = { value: string; max_age: number | null };

/** The session cookie from a response's Set-Cookie headers, or null when there is none.
 *  An empty value (the API clearing the cookie) counts as none. */
export function parseSessionCookie(setCookies: string[]): SessionCookie | null {
  for (const header of setCookies) {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator) !== SESSION_COOKIE) continue;
    const value = pair.slice(separator + 1);
    if (!value) return null;
    const maxAge = attributes.find((a) => a.toLowerCase().startsWith("max-age="));
    const seconds = maxAge ? Number(maxAge.slice("max-age=".length)) : NaN;
    return { value, max_age: Number.isFinite(seconds) ? seconds : null };
  }
  return null;
}

/** The Cookie header to send to the API, or undefined when there is no session. */
export async function sessionCookieHeader(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    const value = (await cookies()).get(SESSION_COOKIE)?.value;
    return value ? `${SESSION_COOKIE}=${value}` : undefined;
  } catch {
    // Not inside a request (a unit test, a build step): there is no session to send.
    return undefined;
  }
}
