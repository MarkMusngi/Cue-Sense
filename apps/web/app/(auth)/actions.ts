"use server";

// Server Actions for signing in and out. The API starts the session; these copy its cookie
// onto the browser's response (HttpOnly, so scripts cannot read it) and send the browser on.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, type SessionCookie } from "@/lib/auth-session";
import {
  signIn,
  signOut,
  signUp,
  type ApiResult,
  type SignedIn,
} from "@/lib/api-client";

export type AuthFormState = {
  error?: string;
  field_errors?: { email?: string; password?: string };
};

async function setSessionCookie(session: SessionCookie) {
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    // Secure unless SESSION_COOKIE_SECURE=false, the same default as the API.
    secure: process.env.SESSION_COOKIE_SECURE !== "false",
    path: "/",
    ...(session.max_age === null ? {} : { maxAge: session.max_age }),
  });
}

function stateFromFailure(result: Extract<ApiResult<SignedIn>, { ok: false }>): AuthFormState {
  const field_errors: AuthFormState["field_errors"] = {};
  for (const detail of result.details ?? []) {
    if (detail.path[0] === "email") field_errors.email ??= detail.message;
    if (detail.path[0] === "password") field_errors.password ??= detail.message;
  }
  if (Object.keys(field_errors).length > 0) return { field_errors };
  return { error: result.error };
}

async function authenticate(
  call: (email: string, password: string) => Promise<ApiResult<SignedIn>>,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const result = await call(email, password);
  if (!result.ok) return stateFromFailure(result);
  await setSessionCookie(result.data.session);
  redirect("/");
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  return authenticate(signIn, formData);
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  return authenticate(signUp, formData);
}

export async function signOutAction(): Promise<void> {
  await signOut();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in");
}
