import Link from "next/link";

const NAV_ITEMS = [
  { label: "Drills", href: "/" as string | null, testid: "nav-drills" },
  // Sessions and Progress screens arrive in later tickets.
  { label: "Sessions", href: null, testid: "nav-sessions" },
  { label: "Progress", href: null, testid: "nav-progress" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <aside
        className="flex flex-[1_1_240px] flex-col gap-6 border-r border-line bg-surface px-5 py-7 md:max-w-60"
        data-testid="app-sidebar"
      >
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 34 34" aria-hidden="true">
            <path
              d="M17 2 L32 17 L17 32 L2 17 Z"
              fill="none"
              stroke="var(--chalk)"
              strokeWidth="3"
            />
            <circle cx="17" cy="17" r="5" fill="var(--text)" />
          </svg>
          <span className="font-display text-2xl font-bold tracking-wide">CUE SENSE</span>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current="page"
                data-testid={item.testid}
                className="flex h-11 items-center rounded-[10px] bg-raised px-3 font-semibold"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                data-testid={item.testid}
                className="flex h-11 items-center rounded-[10px] px-3 font-medium text-muted opacity-60"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 text-[13px] text-muted">
          <span className="font-medium text-text">Dev user</span>
          <span className="font-mono text-xs">dev@cuesense.local</span>
        </div>
      </aside>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
