# Drill editor and detail screens

Design note for the drill screens in `apps/web` (Jira CUE-26). They follow the editor, detail and library boards of the Claude Design artifact, the API in `docs/architecture.md` section 4.6, and the table editor in `docs/table-editor.md`.

## Screens

| Route | What it is |
|---|---|
| `/drills` | The library. Cards link to the drill, and a "New drill" button opens an empty editor. |
| `/drills/[id]` | Detail: title, difficulty, status and version, a large read-only table, instructions, scoring, tags, version history, and actions (Edit, Duplicate, Activate, Archive, Unarchive). |
| `/drills/new` | The editor, empty. |
| `/drills/[id]/edit` | The editor on the drill's current version. |

The design also shows stats tiles on the detail screen and a "Start drill run" button. They are not built here: statistics come with the dashboard and drill runs with the session runner.

## How a save reaches the API

The web client (`lib/api-client.ts`) is server-only: the API is on the Docker network (`API_URL`), not reachable from the browser. So saves go through Next.js Server Actions in `app/(app)/drills/actions.ts`: each calls an api-client function and returns its result (error `code` and `details` included) as plain data. After a success the action revalidates `/drills` and the drill's page, and the editor navigates to the detail screen. This needs no CORS and exposes nothing; when authentication arrives, the actions are the place to forward the session.

## Versions

Only a changed layout, instructions or scoring creates a drill version (`PUT /drills/{id}`, `docs/architecture.md` section 4.5). Title, description, difficulty and tags belong to the drill and save without a new version. The editor says which will happen before the person saves: `willCreateVersion` in `lib/drill-form.ts` compares the form with the current version (keys sorted, so key order never counts), and the Save button reads "Save v3" or just "Save". A save carries `base_drill_version_id`; if the drill was saved elsewhere meanwhile the API answers 409 `stale_version`, and the editor shows a panel, keeps the edits on screen, and links to the latest version instead of overwriting it.

## Form state and validation

- `lib/drill-form.ts` holds the form (numbers as strings, so a half-typed value is not lost), parses them in one place, and checks everything the API would reject before sending: a title and instructions, whole numbers of 1 or more, and a pass threshold no higher than the attempts per set (for points, attempts times the most points per attempt). Messages appear inline after the first Save attempt.
- `lib/drill-problems.ts` maps the API's error details (`path` into the request body) to fields: `["layout", "object_balls", 1]` becomes "Ball 2 overlaps another ball." with a "Select the ball" button that selects it in the table editor (`TableEditor` takes an optional controlled `selected`); `["scoring", "pass_threshold"]` marks the Makes to pass field, and so on. Unknown codes show the API's own message. The editor itself keeps balls on the table and apart, so layout errors are rare.
- Any edit clears the API's problems, which were about the old form.

## Phone

The settings are tabs (Details, Scoring, Notes) below `md` and one column of sections from `md` up. Controls are 44 px. The header uses a shorter version line on a phone ("Editing v2 · saving makes v3").

## States

Loading (a skeleton while a page's data loads), not found (a missing drill, or an id that is not a UUID), an API error card, and no tags yet. Unsaved edits trigger the browser's leave warning.

## Tests

- Vitest: `drill-form`, `drill-problems`, `api-client` (every call with `fetch` mocked), the Server Actions, and components (editor, detail pieces, `LinkButton`, `TextArea`, the card link).
- Playwright (`e2e/drills.spec.ts`, on the seeded stack): library to detail, a not-found drill, creating a drill by placing a ball, a missing-field save, a new version from changed instructions, a title-only edit that does not create one, a real stale-version conflict between two open editors, and a phone pass. Each spec makes its own drill with a unique title.
