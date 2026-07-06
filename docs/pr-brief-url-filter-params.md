# PR Brief: URL query-param filter initialization for Match Play browse

## Goal

Teach the existing `/matches` browse screen to read its filter state from URL query
parameters on mount, so a link like `/matches?level=3.5&format=singles` lands the user
on the page already filtered. Today the filters initialize only from internal `useState`
defaults; this PR makes the URL an additional (and authoritative-on-load) source.

This is the foundation the upcoming public landing + intent flow will route into — but
it's also independently useful right now: shareable, pre-filtered match links for email
blasts (Mailchimp) and texts.

## Why this first

- Smallest possible contained change — touches the filter initialization only.
- Independently shippable value: shareable filtered URLs work the day this merges,
  with no landing page or intent flow required.
- Establishes the pattern (`read filters from URL on mount`) that group lessons and
  coaches pages will reuse later.

## Scope

In scope:
- `BrowseScreen.jsx` (and/or the parent `TennisMatchApp.jsx` where the filter state
  lives) on branch off `main` — read query params on mount, initialize filter state.
- Keep the existing filter UI and `listMatches` flow exactly as-is; this only changes
  where the *initial* filter values come from.

Out of scope:
- No new pages, no landing, no intent flow.
- No backend/Sahil changes — uses the existing `listMatches` call.
- Do not change group lessons or coaches pages in this PR (they follow the same
  pattern in later PRs).

## Behaviour

On mount, the Match Play browse screen should read these query params and seed the
corresponding existing filter state if present, otherwise fall back to current defaults:

| Query param | Existing state it seeds | Example values |
|-------------|------------------------|----------------|
| `level`     | `selectedLevelFilter`   | `2.5`, `3.0`, `3.5`, `4.0`, `4.5` |
| `format`    | `selectedFormatFilter`  | `singles`, `doubles`, `round-robin`, `dingles` |
| `gender`    | `selectedGenderFilter`  | `mens`, `womens`, `mixed` |
| `distance`  | `distanceFilter`        | `5`, `10`, `20`, `50` |
| `day`       | `selectedDayKey`        | a `YYYY-MM-DD` date, or `all` |
| `tab`       | `activeFilter` / scope  | `discover`, `my`, `hosting` |

Rules:
- A param that's absent → that filter keeps its current default. (Partial params are
  fine: `?level=3.5` alone just sets level, everything else default.)
- An invalid value (e.g. `level=9.9`, `format=banana`) → ignore it, fall back to default
  for that one filter. Never crash or show an empty broken state from a bad param.
- Param values map to the page's existing internal filter representation — confirm the
  exact internal values first (e.g. is format stored as `"Singles"` or `"singles"`?) and
  map case/spelling accordingly. Investigate before wiring.
- On load, the filter chips/controls must visually reflect the seeded state (e.g.
  `?level=3.5` shows the Level chip reading "3.5", not "Any"), and the list fetch uses
  the seeded filters — so the user sees a filtered list immediately, not a default list
  that re-filters a beat later.

## Should the URL stay in sync after load? (decision needed)

Two options — recommend the first, but flag for confirmation:

- **A — Read on mount only (recommended for this PR).** Params seed the initial state;
  after that, the user changing filters in the UI does not rewrite the URL. Simplest,
  lowest-risk, fully delivers the "land pre-filtered" goal. URL may go stale vs. UI after
  manual changes — acceptable for v1.
- **B — Two-way sync.** Changing a filter also updates the URL (so the URL is always
  shareable as the current view). More work, more edge cases (history spam, back-button
  behaviour). Defer unless explicitly wanted.

Default to A unless told otherwise.

## Investigate before building (report first, no code)

1. Confirm where the filter state actually lives (parent `TennisMatchApp.jsx` vs.
   `BrowseScreen.jsx`) and the exact internal value format for each filter
   (`selectedLevelFilter`, `selectedFormatFilter`, `selectedGenderFilter`,
   `distanceFilter`, `selectedDayKey`, `activeFilter`).
2. Confirm the router/runtime: the app uses hash routing — verify how query params
   read with the current router (e.g. `useSearchParams` vs. parsing
   `location.search`/hash). Use whatever matches the existing routing setup.
3. Confirm the page currently initializes those filters from `useState` defaults (so we
   know we're adding URL-seeding, not replacing an existing mechanism).

Report findings + a short plan, then build after approval.

## Verification

- `/matches` with no params → behaves exactly as today (defaults).
- `/matches?level=3.5` → loads with Level = 3.5, list filtered to 3.5, other filters default.
- `/matches?level=3.5&format=singles&distance=10` → all three seeded, list reflects them.
- `/matches?level=9.9` (invalid) → ignored, loads as default, no crash.
- Filter chips visually match the seeded state on first paint.
- eslint clean, `npm run build` passes.

## Commit

Small isolated PR on a branch off `main` (e.g. `feat/matches-url-filter-params`).
Not on `refactor/browse-screen-extract` — that's the redesign branch; this is a separate
capability and should be its own reviewable PR.
