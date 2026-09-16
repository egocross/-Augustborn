# Task 5 report — input and report UI

## Delivered

- Replaced the starter page with a Chinese lunar-date and 24-hour China-standard-time form.
- Rendered model-provided report sections by iterating `report.sections`; the UI makes no assumption about section count or heading names.
- Added a post-report feedback form that transmits exactly `rating` and `wantsDeepAnalysis`.
- Added a paper/ink editorial visual system, responsive inputs, loading/error states, and Chinese metadata.

## Privacy decision

The report deliberately renders in `BirthForm` on `/` after the API response, held only in React component state. Navigating to `/result` would require a query parameter, persistent browser state, a cookie, or a server-side store to transfer it, all of which conflict with the privacy requirement. Direct visits to `/result` therefore show a re-analysis entry point; refreshes also discard the in-memory report.

No UI code accesses `localStorage`, `sessionStorage`, cookies, URL query parameters, or a database for birth input or report data.

## Test-first evidence

- `components/report-view.test.tsx` was first run without `ReportView` and failed with the expected unresolved module error, then passed after the dynamic renderer was added.
- `components/birth-form.test.tsx` first failed before `BirthForm` existed, then passed after the in-memory form flow was implemented.
- `components/feedback-form.test.tsx` first failed before `FeedbackForm` existed, then passed after the two-field feedback flow was implemented.

## Verification

- `npm run test` — 10 files, 34 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed; `/`, `/result`, and both API routes compile successfully.
