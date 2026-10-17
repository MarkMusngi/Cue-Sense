# Progress dashboard

The Progress screen (`/progress`) shows three things, each from one `/stats` endpoint ([stats-contract.md](stats-contract.md)). All sums happen in SQL in `stats_service`; the browser only draws.

| Panel | Endpoint | What it shows |
|---|---|---|
| Success rate by drill | `GET /stats/drills/{id}/success-rate` | A line of success rate per day (7-day range) or per week, one drill at a time. A dashed line marks where a new drill version first appears; a dotted one, with "scoring changed", where the scoring kind differs from the version before. |
| Attempts per week | `GET /stats/weekly-volume` | One bar per week, zero weeks included as a stub. |
| By tag | `GET /stats/tags` | Attempts and success rate per tag. A drill with several tags counts under each. |

## Behaviour

- The range is in the URL: `?range=7|30|90` (default 30) and `&drill=<id>`. The drill defaults to the first in the library. The range toggle is links and the drill picker changes the URL, so reloads and shared links work.
- Days are cut in UTC (the API default). The browser's time zone is not sent yet.
- Voided attempts are never counted. Archived drills are.
- Points with fewer than 5 attempts are drawn faded, with a note. One or two shots say little.
- The line crosses weeks with no attempts, because the API omits empty buckets. The x axis is the date range, so a gap shows as distance.
- Each chart has an accessible name that states the trend, and the line chart carries a hidden table of its points.
- Every panel has an empty state and an error state of its own.

## Not built

The design board also shows summary tiles (overall rate, attempts, sets passed, longest streak), a pass-mark line and a recent sessions list. The contract has no data for them, and goals and streaks are out of scope for now. The charts are plain SVG; no chart library was added.
