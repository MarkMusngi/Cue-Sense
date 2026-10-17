# Authentication

Real sign-in replaced the stubbed dev user in CUE-35. The approach was chosen by the repo owner: server-side login sessions in the database, an HttpOnly cookie, and argon2 password hashes.

## How it works

1. **Sign up** (`POST /users`) or **sign in** (`POST /login-sessions`) with `{email, password}`. Emails are trimmed and lowercased. Passwords are 8 to 128 characters and are hashed with argon2 (`argon2-cffi` defaults).
2. The API creates a `login_sessions` row and sets the `cue_session` cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` of `SESSION_TTL_HOURS` (default 30 days), `Secure` when `SESSION_COOKIE_SECURE=true` (set it behind https).
3. The cookie value is a random token (`secrets.token_urlsafe(32)`). Only its SHA-256 is stored, so a copy of the database cannot be used to sign in.
4. `get_current_user` reads the cookie and finds an unexpired row. No cookie, an unknown token or an expired one is a 401 `unauthenticated`. A wrong password, an unknown email and an account with no password are all the same 401 `invalid_credentials`, and an unknown email still costs one hash check, so the two look alike.
5. **Sign out** (`DELETE /login-sessions/current`) deletes that row and clears the cookie. Other sign-ins stay. Expired rows are deleted whenever someone signs in.

Services and routers other than the auth router are unchanged: they take the user from `get_current_user`, and owner scoping (404 for another user's resources) works as before.

## The web app

The browser never calls the API. The Next.js server does, from Server Components and Server Actions, so it carries the session:

- `lib/api-client.ts` sends the browser's `cue_session` cookie on every API call.
- The sign-in and sign-up Server Actions (`app/(auth)/actions.ts`) call the API, copy the cookie it sets onto the browser response, and redirect to `/`. Sign out calls the API, deletes the cookie and redirects to `/sign-in`.
- `middleware.ts` sends a request with no session cookie to `/sign-in`. The app layout (`app/(app)/layout.tsx`) asks `GET /users/me` and sends a 401 (an expired or stale cookie) to `/sign-in`, where signing in replaces the cookie.
- The app shell shows the signed-in email and a Sign out button.

There is no `next` redirect parameter: after signing in you land on the home page.

## Local development and tests

- `docker compose exec api python -m app.scripts.seed` creates `dev@cuesense.local` and, when `DEV_USER_PASSWORD` is set (it is in `.env.example`), gives it that password. The seed never replaces an existing password.
- Playwright signs in as that user once (`apps/web/e2e/global-setup.ts`) and every spec starts from the saved state. Cookies belong to the host and not the port, so the API calls the specs make on port 8000 carry the same session. `auth.spec.ts` starts signed out.
- API tests that are not about sign-in override `get_current_user`. `tests/test_auth.py` sends real cookies.

## Known limits (not built)

- No password reset, email verification, or sign-in rate limiting.
- Sign-up is open to anyone who can reach the API. An existing email is reported (409 `email_taken`), which lets a visitor test whether an address has an account.
- Sessions do not slide: a sign-in lasts `SESSION_TTL_HOURS` from the moment it starts.
- There is no list of devices or "sign out everywhere".
- The API's own CSRF protection is `SameSite=Lax` plus having no CORS. The Next.js Server Actions check the request origin themselves.
