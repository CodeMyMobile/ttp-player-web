# Home page redesign — build brief

**Status:** PRs 1 and 2 shipped. PR 3 dropped. PR 4 in review (#313). PR 5 next, once it merges.

## Canonical sources

- **Design:** the state mockups in `docs/home-states/` — `cold`, `rated`, `rated-no-bookings`,
  `in-league`, `established`, `decline-confirm`, `video-unavailable`, and `index`
  (all frames side by side). These are the spec; where anything disagrees with them,
  they win. Skip the inlined `<style>` block when reading — ~12KB of Tailwind per file
  that tells you nothing.
- **Backend reality:** `docs/home-backend-audit-v2.md`, including §0 corrections and the
  traces. Read it before writing any data-fetching code.

## Rules

- **One PR at a time, off `main`, small and isolated.**
- **Plan mode first on every PR.** Show the plan, wait for approval.
- **British spelling in user-facing copy.**
- **Never display data we can't verify.** Two bugs in this sequence have been numeric
  zero passing as presence — `Number(null)` returning 0, and a rated gate that was open
  for 94% of accounts. Be deliberate about zero versus null.
- **Stop and report on any mismatch** — a conflict, or a brief that asserts a state that
  isn't true. Don't resolve or work around it.
- **Stacked branches touching the same file must branch off the previous branch**, not
  `main`. See `CLAUDE.md`.
- **No React test harness exists.** Pull branching logic into pure functions and test
  those, as `resolveStatusTiles` does.
- Match existing patterns in `src/api/*`, `src/pages/*`, and existing hooks.

## Established facts

Decisions already made and shipped. Don't re-derive or revisit these.

| | |
|---|---|
| Rated gate | `matches_played > 0`. **Not** non-null `current_rating` — 1134 of 1203 production profiles carry `current_rating = 0, matches_played = 0` |
| Ladder position | Recompute client-side by sorting on `current_rating`. `GET /match-results/rankings` assigns `rank` *after* re-sorting by distance, so under geo scoping it's proximity order. **Never display the `rank` field** |
| Booking sources | **Three, not four.** League fixtures have no scheduled start time — only `played_date`, retrospective |
| Bookings ≠ rated | The bookings tile keys on having bookings, not on being rated. Don't reintroduce a gate |
| Rating routes | Any confirmed match result rates you; no league required, and no profile route exists |
| Cold-state CTA | "Play a match to get rated" → `/matches`. **Not** `/leagues` — all leagues are draft, and eligibility resolves `current_rating = 0` to `rating_out_of_band` for 1099 of 1142 unrated players |
| Timezone | "Today" anchors to the user's local timezone, with a comment marking it. Non-lesson types are unconfirmed backend-side |
| Restring pickup subtitle | Orders carry `vendor_name` and **no location field of any kind**. The mockup's "Tennis Garage · Penmar" ships as the vendor alone — **don't invent a location**. It needs a backend field first |

## Deliberate omissions — do not reinstate

If you think one should exist, raise it; don't build it.

| Cut | Why |
|---|---|
| Rating delta ("+0.2") | `previous_rating` is overwritten every match; no windowed change is derivable |
| NTRP equivalence | `calculated_ntrp` ~5% populated; a client estimate of a standard we don't own |
| "3rd at Penmar" | Data supports proximity, not club membership. Copy is **"3rd nearby"** |
| Level filter control | `filters.level` reaches a WHERE clause for group lessons only, as exact string equality on free text, and silently returns zero results on an unrecognised value |
| Feed card end times | Not reliably available |
| Feed card spot counts | Not reliably available for matches. **Early v2 candidate** — scarcity is the main reason to tap Join |
| Numeric provisional threshold | Server config, never returned, two conflicting values. Copy is "Your rating settles as you play" |
| "Propose time" on invites | No endpoint |
| Unentered-score alert | No endpoint. Component accepts the type; don't wire it |

## PR sequence

**PR 1 — Header and status tiles.** Shipped (#306).

**PR 2 — Action grid.** Shipped (#308).

**PR 3 — Feed filters and cards.** *Dropped.* Level filtering is unusable; revisit with
type chips alone if wanted.

**PR 4 — Today row and alert stack.** In review (#313). Today row sits **below** the tile
pair, red chip — every mockup puts the tile pair first, and this brief previously said
"above", which was wrong. Alert container below it: restring pickup
(`GET /player/restringing/orders`) and unentered score (accepted but unwired). **Two alert
types, not three** — the booking reminder listed here originally is the today row itself,
and no mockup draws a separate one. Screen order: tiles, today row, invite card, alerts,
grid. Transition the grid when the container empties — a ~90px shift shouldn't snap under
someone's thumb.

**PR 5 — Invite card.** Accept and Decline only, with the decline confirm step. Copy is
"will be notified", not "will get a text" — the SMS send is fire-and-forget with a
swallowed error, so the API can't confirm delivery. Sort soonest-first client-side;
`GET /invites` returns `created_at DESC`.

**PR 6 — Season module.** Active seasons only. Progress, time remaining, and opponents
still to play from `GET /leagues/{id}/result-opponents`. **No position** — that lives in
the rating tile and isn't league-scoped. Multi-league behaviour unresolved; confirm
before building.

**PR 7 — Off court module.** Tip-of-the-day row plus training plan link. Needs a cached
playlist endpoint. Must degrade to the training-plan row alone when the video is
unavailable.

## Open

- **Multi-league** — no overlap guard found on enrolment, so concurrent seasons appear
  possible. Product decision pending; blocks PR 6.
- **The unrated state is the majority state** — 1134 of 1203 accounts. The design was
  drawn assuming the reverse. Redesign pending; the left tile slot is free until a
  player is rated and is the natural place for it.
