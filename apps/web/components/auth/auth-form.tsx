"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { AuthFormState } from "@/app/(auth)/actions";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

const COPY = {
  "sign-in": {
    title: "Sign in",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New here?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
    autoComplete: "current-password",
  },
  "sign-up": {
    title: "Create an account",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
    autoComplete: "new-password",
  },
} as const;

/** Email and password form for sign in and sign up. A plain form post until React hydrates. */
export function AuthForm({ mode, action }: AuthFormProps) {
  const copy = COPY[mode];
  const [state, formAction, pending] = useActionState(action, {} as AuthFormState);

  return (
    <section className="w-full max-w-sm rounded-[14px] border border-line bg-surface p-5 md:p-6">
      <h1 className="font-display text-3xl font-semibold uppercase tracking-wide">{copy.title}</h1>
      <form action={formAction} className="mt-5 flex flex-col gap-4" data-testid={`${mode}-form`}>
        {state.error && (
          <p
            role="alert"
            data-testid="auth-error"
            className="rounded-[10px] border border-miss px-3 py-2 text-[13px] text-miss"
          >
            {state.error}
          </p>
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          error={state.field_errors?.email}
          data-testid="auth-email"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={copy.autoComplete}
          required
          minLength={mode === "sign-up" ? 8 : undefined}
          maxLength={128}
          hint={mode === "sign-up" ? "At least 8 characters." : undefined}
          error={state.field_errors?.password}
          data-testid="auth-password"
        />
        <Button type="submit" variant="primary" disabled={pending} data-testid="auth-submit">
          {pending ? copy.pending : copy.submit}
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted">
        {copy.switchText}{" "}
        <Link
          href={copy.switchHref}
          data-testid="auth-switch-link"
          className="inline-flex min-h-11 items-center font-medium text-text underline underline-offset-2"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </section>
  );
}
