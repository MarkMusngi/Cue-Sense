import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signUpAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getMe } from "@/lib/api-client";

export const metadata: Metadata = { title: "Create an account · Cue Sense" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if ((await getMe()).ok) redirect("/");
  return <AuthForm mode="sign-up" action={signUpAction} />;
}
