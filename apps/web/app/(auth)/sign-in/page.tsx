import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signInAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getMe } from "@/lib/api-client";

export const metadata: Metadata = { title: "Sign in · Cue Sense" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Someone who is already signed in has nothing to do here. A stale cookie is a 401 and
  // falls through to the form; signing in replaces it.
  if ((await getMe()).ok) redirect("/");
  return <AuthForm mode="sign-in" action={signInAction} />;
}
