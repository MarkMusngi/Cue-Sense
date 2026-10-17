"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button-styles";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cx } from "@/lib/cx";
import { NAV_ITEMS, isActive } from "@/lib/nav";

/** Small icons for the phone tab bar; the label always sits under them. */
const NAV_ICONS: Record<string, ReactNode> = {
  drills: (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3" y="5" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="11" r="1.6" fill="currentColor" />
      <circle cx="14" cy="9" r="1.6" fill="currentColor" />
    </svg>
  ),
  sessions: (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 7 V11 L14 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  progress: (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M4 17 V12 M9 17 V8 M14 17 V10 M19 17 V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

function Brand() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2 rounded-[10px] px-2">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="var(--text)" />
        <circle cx="10" cy="10" r="2.5" fill="var(--chalk)" />
      </svg>
      <span className="font-display text-xl font-semibold uppercase tracking-wide">Cue Sense</span>
    </Link>
  );
}

function SignOutButton({
  action,
  testId,
  className,
}: {
  action: () => Promise<void>;
  testId: string;
  className?: string;
}) {
  return (
    <form action={action}>
      <button type="submit" data-testid={testId} className={buttonClasses("ghost", className)}>
        Sign out
      </button>
    </form>
  );
}

/**
 * The frame around every app page: a sidebar on desktop and a bottom tab bar on
 * phones. Both carry the same links so each layout is complete on its own.
 */
export function AppShell({
  children,
  userEmail,
  signOutAction,
}: {
  children: ReactNode;
  /** Who is signed in; null when the API could not say. */
  userEmail: string | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-20 rounded-[10px] bg-chalk px-4 py-3 font-semibold text-chalk-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside
        data-testid="app-sidebar"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 md:flex"
      >
        <Brand />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-testid={`sidebar-nav-${item.key}`}
                className={cx(
                  "flex min-h-11 items-center rounded-[10px] px-3 text-[15px] font-medium",
                  active ? "bg-chalk-soft text-text" : "text-muted hover:bg-raised hover:text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Signed in</p>
            <p data-testid="sidebar-user-email" className="truncate font-mono text-xs text-muted">
              {userEmail ?? "Unknown"}
            </p>
          </div>
          <ThemeToggle data-testid="sidebar-theme-toggle" />
        </div>
        <SignOutButton action={signOutAction} testId="sidebar-sign-out" className="w-full" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 md:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <SignOutButton action={signOutAction} testId="header-sign-out" />
            <ThemeToggle data-testid="header-theme-toggle" />
          </div>
        </header>
        <main id="main" className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>

      <nav
        aria-label="Main"
        data-testid="app-tab-bar"
        className="fixed inset-x-0 bottom-0 z-10 grid auto-cols-fr grid-flow-col border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-testid={`tab-bar-nav-${item.key}`}
              className={cx(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                active ? "text-chalk" : "text-muted",
              )}
            >
              {NAV_ICONS[item.key]}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
