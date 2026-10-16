import type { ReactNode } from "react";

/** The title row at the top of each app page. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-3xl font-semibold uppercase tracking-wide md:text-4xl">{title}</h1>
      {children}
    </header>
  );
}
