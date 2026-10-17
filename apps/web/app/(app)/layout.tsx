import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { AppShell } from "@/components/app-shell/app-shell";
import { getMe } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  // An expired or unknown session. The sign-in page replaces the stale cookie on sign in.
  if (!me.ok && me.code === "unauthenticated") redirect("/sign-in");
  return (
    <AppShell userEmail={me.ok ? me.data.email : null} signOutAction={signOutAction}>
      {children}
    </AppShell>
  );
}
