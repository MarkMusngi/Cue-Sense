import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 md:px-8">
        <span className="font-display text-xl font-semibold uppercase tracking-wide">Cue Sense</span>
        <ThemeToggle data-testid="auth-theme-toggle" />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 md:items-center">
        {children}
      </main>
    </div>
  );
}
