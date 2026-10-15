# Design system ("Night hall")

How the web app looks and how its shared pieces are used. The tokens live in `apps/web/app/globals.css`; the controls live in `apps/web/components/ui/`. A live preview of every control is at `/dev/ui` in development (it returns 404 in production).

## Direction

A pool hall at night: dark slate surfaces, an ivory text colour like the cue ball, chalk blue for the one primary action, and amber for a miss. Dark is the default theme; light is for daylight practice. Both themes are first class and both are tested for contrast.

## Tokens

Use the Tailwind classes, never raw hex values in components. Each token has a class such as `bg-surface`, `text-muted`, `border-control`.

| Token | Use |
|---|---|
| `bg` | Page background |
| `surface` | Cards, sidebar, tab bar, inputs |
| `raised` | Hover and pressed fills, the partial outcome |
| `line` | Dividers and card borders (decorative only) |
| `control` | Borders that identify a control, such as inputs and chips |
| `text` | Body and headings |
| `muted` | Secondary text, labels, inactive nav |
| `chalk` / `chalk-ink` | Primary action fill and the text on it; active nav |
| `chalk-soft` | Selected fills (active sidebar item, pressed chip) |
| `miss` / `miss-soft` | Miss outcome, errors |
| `part` | Partial outcome mark in rail sights |
| `focus` | The focus ring |

The two exceptions to "tokens only" are the cue ball (`#F2EEE4`) and hit point (`#D2412F`) in `CueSpin`, which are physical object colours and read on both themes.

Fonts: Barlow Condensed for display headings (`font-display`, uppercase), IBM Plex Sans for body (`font-sans`), IBM Plex Mono for data (`font-mono`).

## Contrast rules

`apps/web/lib/design-tokens.test.ts` reads `globals.css` and fails the build if a pair drops below WCAG AA in either theme:

- Text pairs (`text`, `muted`, `chalk-ink` on `chalk`, `miss` on its soft fill, and so on): at least 4.5:1.
- Non-text UI pairs (`control`, `focus`, `part`, `chalk` against the backgrounds): at least 3:1.

`line` is decorative and is not tested; never use it as the only border of a control. If you add a token or a new pairing, add it to that test.

## Themes

- `themeScript` in `apps/web/lib/theme.ts` runs in `<head>` before the page paints, so there is no flash. It uses the stored choice, else the system setting, else dark.
- The choice is stored in `localStorage` under `cue-sense-theme`. `ThemeToggle` switches it.
- Tailwind's `dark:` variant follows `data-theme`, not the OS. Prefer tokens over `dark:`; they already switch.

## Layout

- `AppShell` wraps every page in `app/(app)/`: a sidebar from the `md` breakpoint up, a bottom tab bar below it. Both have the same links (`lib/nav.ts`).
- Page content sits in `max-w-5xl` with `p-4` on phones and `p-8` on desktop, under a `PageHeader`.
- The shell starts with a "Skip to content" link to `<main id="main">`.
- Touch targets are at least 44 px (`min-h-11`). The outcome buttons in a drill run are much larger on purpose.
- Motion is off when the user asks for reduced motion (global rule in `globals.css`).

## Test ids

Playwright and component tests find elements by `data-testid`, never by CSS class. Rules:

- Ids are kebab-case and name the thing, not its look: `outcome-success`, not `blue-button`.
- Shared controls take a `data-testid` prop with a sensible default (`button`, `chip`, `text-field`). Pass a specific id wherever a page has more than one.
- Derived ids add a suffix: `${testId}-error` for a field's error, `segmented-control-${value}` for an option, `rail-sight-${index}` for a sight.
- Shell ids: `app-sidebar`, `app-tab-bar`, `sidebar-nav-<section>`, `tab-bar-nav-<section>`, `sidebar-theme-toggle`, `header-theme-toggle` (`ThemeToggle` defaults to `theme-toggle`).
- Page ids: `<section>-empty` for an empty state; the home page keeps `health-status`, `health-api`, `health-database`, `health-error`.
- Once a test depends on an id, renaming it is a breaking change: update the tests in the same PR.

## Controls

| Component | Notes |
|---|---|
| `Button` | `primary`, `secondary`, `ghost`. `type="button"` unless you pass `type="submit"`. One primary per view. |
| `OutcomeButton` | Make, Miss, Partial. `large` for the drill run screen, `medium` elsewhere. Labelled by text and icon, not colour alone. |
| `Chip` | Toggle filter; `pressed` sets `aria-pressed`. |
| `SegmentedControl` | Pick one of a few options; a labelled `group` of pressed buttons. |
| `RailSights` | Set progress as diamond sights; an image with a spoken summary. |
| `CueSpin` | Cue ball face with the hit point from a layout's `cue_spin`; an image with a spoken description. |
| `TextField` | Label, hint and error wired with `aria-describedby`; an error sets `aria-invalid`. |
| `ThemeToggle` | Switches and remembers the theme. |
