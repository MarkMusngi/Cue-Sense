export type NavItem = {
  label: string;
  href: string;
  /** Short name used in data-testid values, e.g. "sidebar-nav-drills". */
  key: string;
};

/** The app's top-level sections, in the order they appear in the sidebar and tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Drills", href: "/drills", key: "drills" },
  { label: "Sessions", href: "/sessions", key: "sessions" },
  { label: "Progress", href: "/progress", key: "progress" },
];

/** True when `pathname` is the section at `href` or a page inside it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
