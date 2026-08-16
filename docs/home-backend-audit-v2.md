# Backend audit v2 — home page redesign

**Date:** 2026-08-15 · **Read-only.** Nothing was implemented or changed.

**Sources.** `ttp-player-web` @ `origin/main` `c58a575`; `ttp-api` @ `origin/main` `c205767`
(read from a local branch that differs only in lesson-time files, none of which touch this audit).
Unlike v1, which was frontend-only, **this audit reads the API repo directly** — which is why most
of v1's UNKNOWNs are now VERIFIED.

**Labels:** VERIFIED (endpoint definition, query, or live response) · INFERRED (from usage) ·
UNKNOWN (not determinable).

> **Nothing in `ttp-player-web` is type-checked at build time** *(corrected — PR 1)*. No
> TypeScript compiler is in the dependency tree, and `npm run build` is `vite build`, which strips
> types without checking them. The interfaces in `src/api/*.ts` are therefore **assertions about
> the API, not guarantees** — they can drift from the real response with nothing failing. Weight
> any finding here that rests on a declared type accordingly. Two findings below were wrong for
> exactly that reason.

> **On the mockups.** Sections 1–7 were written from the prose description in the brief, because
> the mockups were not in the repo at the time. They have since been added to `docs/` and checked
> against — see **"Verification against mockups"** at the end, which corrects one finding (the
> rating delta) and adds field-level gaps. Read the two together. `docs/tip-of-day-investigation.md`
> still does not exist, and the off-court module remains unaudited by design. v1 lives only on
> `feat/ladder-position-first` (commit `901fc40`); it was never merged.

---

## 0. Corrections from PR 1

Found while building PR 1 (#306), after this audit was written. Each is marked at its original
location too. **These supersede what the sections below say.**

**0.1 League fixtures are not a booking source.** `LeagueFixture` (`src/api/leagues.ts:96-108`)
carries `played_date` — when a match *was* played — and no scheduled start time. It cannot answer
"next Sat 10 AM". **Bookings this week and the today row have three sources, not four.** A league
match becomes a booking once it is arranged as an actual match, which arrives through the matches
source. Affects §3 row 3, §4, and §6.

**0.2 `fetchPlayerBookings` cannot feed the bookings tile.** `src/api/playerLessons.ts:156`
returns `{ data: number[] }` — lesson ids with no times. The name is the trap; it is a list of
what you have booked, not what is booked. **`getPlayerUpcomingLessons`
(`src/api/player.ts:41`) is the usable private-lesson source.**

**0.3 Nothing is type-checked at build time.** See the note above. This is why 0.1 and 0.2 were
both missed: the audit read declared types rather than the values.

**0.4 The rated gate can only be cleared by a match result or league enrolment.**
`player_profile.current_rating` — the field the gate depends on — is written in exactly three
places: `ttp-api:src/services/rating_engine.js:129` when a match result is processed,
`ttp-api:src/services/league_enrollment.js:365-371` where enrolment seeds it, and
`ttp-api:routes/admin_players.js`. **`ttp-api:routes/player_survey.js` contains zero rating
references**, so completing the match-profile questionnaire does not make a player rated.

Consequence: the cold state has **no exit via its own CTA**. A player who taps "Set your level",
answers the five questions, and returns home sees the same cold state, and every rating-gated
surface stays shut. Anything reasoning about rated/unrated — PR 2's grid gating, PR 6's season
module — has to account for this. (VERIFIED by absence: grep for `rating` in `player_survey.js`
returns nothing.)

---

## 1. What changed since v1

**v1's branch problem was real and it produced exactly one wrong finding — plus one it got right
that looked identical.**

| v1 said | Actually, on `main` | |
|---|---|---|
| Restring: no player-scoped order list | **Wrong.** `GET /api/player/restringing/orders` exists (`ttp-api:server.js:129`, `routes/player_restringing.js:53`), alongside `/orders/:id` and `/orders/:id/cancel` | VERIFIED |
| Unentered score: MISSING | **Correct, still.** No `needs_result` / `pending_result` / `unentered` query exists anywhere in `routes/`, `src/`, or `models/` | VERIFIED (by absence) |
| Accept-invite side effects UNKNOWN | **Now known** — see §3 row 4 | VERIFIED |
| Whether `/invites` mixes in open invites UNKNOWN | **Now known: it cannot.** Strictly addressed | VERIFIED |
| Matches have no clean "confirmed" flag | **Wrong.** `match_participants.status` is `'confirmed'` / `'hosting'` (`src/services/invites.js:232`) | VERIFIED |
| `rating_change` window undated | **Now known: there is no window** — see §3 row 6 | VERIFIED |

The brief was right to suspect the unentered-score finding on shape alone. It happens to be
correct anyway — but for a different reason than restring, which had shipped and simply wasn't on
the audited branch.

**New since v1, not covered there at all:** local ladder position, the season module's
"opponents still to play", bookings-this-week as a single count, and the one-rating/one-ladder
model itself.

---

## 2. Ratings model — the backend matches, with one exception

Point by point against the brief:

| Claim | Backend | |
|---|---|---|
| One rating, everything feeds it | **Matches.** A single `player_profile.current_rating`, updated by one `rating_engine`. League results and casual results both route through it | VERIFIED |
| One ongoing ladder, global, filterable | **Matches.** `GET /match-results/rankings` is one global list over `player_profile`, filterable by `gender`, `league`, and geography | VERIFIED |
| Not per-level; position *is* level | **Matches.** No level buckets exist in the ranking query | VERIFIED |
| Leagues are time-boxed sets of opponents feeding the one rating | **Matches.** Standings are per-league and separate from the rating; `rating_leagues` is only a *filter tag* on the ranking | VERIFIED |
| Challenge anyone nearby; proximity a hard filter | **Matches.** `near_lat` / `near_lng` / `radius_miles` on rankings | VERIFIED |

**So the headline answer is the good one: the API already models one rating and one ladder, and
leagues are genuinely separate.** There is no competing "league standings as the ranking" system to
unpick. This is the single biggest difference from what the brief feared.

**The exception, and it is a bug.** `GET /match-results/rankings` computes `rank` as `index + 1`
**after** re-sorting the rows by distance (`routes/match_results.js:234-243`, `:136`). The
underlying query orders by `current_rating DESC` (`models/match_results.js:279-281`), but the route
overrides that whenever geo params are supplied.

So the exact call "3rd at Penmar" requires returns a `rank` that is **proximity order, not rating
order** — the player closest to the court is rank 1. Without geo params the sort comparator returns
0 and stable sort preserves rating order, so `rank` is correct *only* when you don't scope by area.
**The field is wrong precisely when the design needs it.** (VERIFIED.)

Workable today: the response carries `current_rating` on every row, so the client can re-sort and
compute position itself. Treat `rank` as unusable under geo scoping.

---

## 3. Gap table

Ordered by how much UI each blocks.

| # | Item | State | Endpoint | What's absent |
|---|---|---|---|---|
| 1 | **Local ladder position** ("3rd at Penmar") | **Partial** | `GET /match-results/rankings?near_lat&near_lng&radius_miles` | Radius scoping works. **No club/venue scoping** — only a radius. `rank` is proximity-ordered under geo params (§2) so must be recomputed client-side from `current_rating`. Rows *do* carry `primary_court`, `court_area`, and `court_locations[]` with area + lat/lng (`models/match_results.js:239-273`), so **filtering to a named club is achievable client-side** — but it ranks within "players whose home court is Penmar", which is not the same as "players who play at Penmar". VERIFIED |
| 2 | **Unentered score alert** | **Missing** | — | No query for "matches I haven't scored" exists. The opposite direction does: `match_results.status='pending'` = a score someone else entered awaiting my confirmation, with `POST /match-results/:id/confirm` and `/reject`. Those are different alerts. VERIFIED |
| 3 | **Bookings this week / today** | **Partial** | *(corrected — PR 1)* **3 sources**, not four: `GET /player/upcoming_lessons`; `POST /player/upcoming_group_lessons`; `GET /matches`. League fixtures carry no scheduled start (see §0.1) and cannot contribute. Note `fetchPlayerBookings` is **not** the lessons source — it returns ids only (§0.2) | No unified count. **v1's "no confirmed flag on matches" is wrong** — `match_participants.status` is `confirmed`/`hosting`. So a confirmed filter is expressible per type; what's missing is one call that unions them. Timezone anchoring for "today" **UNKNOWN** across types (lessons use `America/Los_Angeles` via `utils/lessonTime`, INFERRED for the rest) |
| 4 | **Invite card** | **Ready** | `GET /invites`; `POST /invites/accept`; `POST /invites/reject` | **The blocker is cleared.** `findByPlayer` queries `where invitee_id = me` (`models/match_invites.js:105-115`); open invites have `invitee_id` NULL so they cannot appear. "Mike wants to play" is safe. Accept: increments `uses`, closes the invite, upserts `match_participants` to `confirmed`, clears the capacity hold, writes `invite_audits`, notifies the organiser — **creates no score record**. Decline: sets `rejected`, recounts confirmed participants, **SMSes the organiser** with remaining open slots. Sorted `created_at DESC`, not soonest-first. VERIFIED |
| 5 | **Season module** | **Ready** | `GET /leagues/{id}/result-opponents` | The hardest field is the one that exists. Returns `{ league, opponents }` = memberships minus already-played, derived server-side (`routes/leagues.js:832-866`). Matches-played and total come from `/standings`; end date from the league record. **No client-side fixture derivation needed** — v1 didn't cover this |
| 6 | **Rating value + delta** | **Ready (value) / Missing (windowed delta)** | `GET /player/personal_details`; `GET /match-results/rankings` | **There is no time-windowed delta, and there cannot be one from current data.** `previous_rating` is overwritten with the pre-match rating on every result (`src/services/rating_engine.js:106-107`) → "change since your last match". `rating_change` on rankings is `current_rating − starting_rating` → lifetime change since seed. Neither is "last 30 days". Cutting the delta from v1 was correct and remains correct. VERIFIED |
| 7 | **Restring alert** | **Ready** | `GET /player/restringing/orders` | Exists on `main`. Order carries `fulfillment_status` + `payment_status` + vendor. Whether the list can be filtered server-side to `ready_for_pickup` is **UNKNOWN** (not read); worst case filter client-side |
| 8 | **Multi-league** | **Unknown → likely yes** | `GET /leagues` → `sections.mine[]` | No overlap guard is visible in `POST /leagues/{id}/enroll` (`routes/leagues.js:505-551`) — failures are payment/payload/eligibility, none temporal. So **concurrent seasons appear possible**. INFERRED, not verified: I could not find a constraint, which is weaker than confirming none exists. This is a data question — see §7 |
| 9 | **Feed filters** | **Partial / Unknown** | `POST /player/discover/nearby` | `filters.level` is plumbed but hardcoded `"All"` client-side. Whether the backend honours it is **UNKNOWN** (not traced). Type filtering is derivable client-side from what's returned. Day-chip counts are computed client-side today, so pre- vs post-filter is a client choice — see §7 |
| 10 | **Rated gate** | **Ready** | `GET /match-results/rankings` | `listPlayerRankings` requires `pp.current_rating IS NOT NULL` (`models/match_results.js:223`). **Presence of a row in rankings is exactly "this player has a rating."** Use that, not survey completion — v1 flagged the distinction and this confirms the clean signal. VERIFIED |
| 11 | **Bookings tile fallback** | **Ready** | — | Zero-state is a count of 0; no endpoint needed |
| 12 | **Header neighbourhood** | **Partial** | rankings rows expose `court_area` | Player's own area available via their `player_court_location`. Whether `/player/personal_details` returns it is **UNKNOWN** |

---

## 4. Can v1 ship?

**v1 scope: header, rating tile, bookings tile, today row, action grid, feed with filters.**

**Yes, with one caveat and one cut.**

- **Header** — ships. Neighbourhood name needs confirming on the profile payload (row 12); fall back to the ladder row's `court_area`.
- **Rating tile** — ships. Value is ready; delta already cut, correctly. **The caveat: local ladder position needs client-side re-ranking** because `rank` is proximity-ordered under geo scoping (§2). That's a client workaround, not a blocker, but it must be written knowingly or the tile will silently show nonsense.
- **Bookings tile** — ships at the cost of **3 calls** and a client-side merge *(corrected — PR 1, was 4)*. Nothing is missing; it's just unaggregated.
- **Today row** — ships, same 3 calls. **Confirm the timezone anchor before trusting it** — a lesson at 11pm Pacific is tomorrow in UTC, and "today" is the whole point of the row.
- **Action grid** — ships. Gate on presence in rankings (row 10).
- **Feed with filters** — ships for type (client-side). **Cut the level filter for v1** unless Sahil confirms the backend honours it; shipping a control that changes nothing is worse than not shipping it.

**Nothing in the v1 scope is blocked.** The things that *are* blocked — unentered-score alert, and
club-accurate ladder position — are all outside it.

---

## 5. Proposed contracts

Only for what's genuinely missing.

**5.1 Unentered scores** — patterned on `GET /leagues/{id}/result-opponents`, which already does
"memberships minus already-played" and is the closest existing shape.

```
GET /api/match-results/awaiting-entry
→ { matches: [ { match_id, played_at, opponent: { user_id, full_name }, league_id | null } ] }
```
Matches where I'm a confirmed participant, `played_at` is past, and no `match_results` row exists.

**5.2 Ranking position, scoped** — a fix plus an addition to `GET /match-results/rankings`:

1. **Fix:** assign `rank` before the distance re-sort, or return `rating_rank` separately from
   array order. This is a one-line ordering change and it is the highest-value item in this audit.
2. **Add:** `court_id` or `area` as a filter, so "3rd at Penmar" means players *at Penmar* rather
   than *within N miles of it*. Rows already carry `court_locations[]`, so the data exists.

**5.3 Aggregate home** — see §6. Patterned on `POST /player/discover/nearby`, the existing
multi-section aggregate.

**Not proposed:** a restring list (exists), season opponents (exists), an invite scoping change
(already correct).

---

## 6. Round trips

Cold load of the full design, as specified:

| Section | Calls |
|---|---|
| Rating + ladder position | 2 (`personal_details`, `rankings`) |
| Bookings this week + today row | **3** (lessons, group lessons, matches) — same 3 serve both *(corrected — PR 1, was 4; fixtures dropped per §0.1)* |
| Invite card | 1 |
| Alerts | 2 available (restring orders, notifications) + 1 that doesn't exist |
| Season module | 2–3 (`/leagues`, `/standings`, `/result-opponents`) |
| Feed | 1–2 |
| **Total** | **12–14 for the full design; 7–8 for the v1 scope** |

**Is `/player/home` worth asking for?** For v1, no — 7–8 parallel calls is tolerable and the
aggregate would take longer to specify and agree than to live with. **For the full design, yes**,
and the argument is the bookings tile: four calls to render "3 booked · Next Sat 10 AM" is
indefensible, and the merge logic (union, filter to confirmed, sort by ISO, exclude pending
invites) is real logic that will drift between home and the schedule page if it lives in the
client twice. Ask for it when the season module and alert stack land, not before.

---

## 7. Questions for Sahil

### Blocks v1

1. **`/match-results/rankings` assigns `rank` after sorting by distance, so with `near_lat`/
   `radius_miles` the rank is proximity order, not rating order.** Can `rank` be computed before
   the distance sort? We need "3rd nearby by rating", and right now the field says "3rd nearest".
2. **What timezone does the API anchor "today" to for lessons and matches?** Lessons use
   `America/Los_Angeles`; we need to know whether matches agree, because the home page
   has a "today" row and a rolling 7-day count.
3. ~~**Does `POST /player/discover/nearby` honour `filters.level`?**~~ **CLOSED** — traced, see
   "Traced answers" below. Honoured, but only for group lessons and only as exact string equality
   against free text. The level control is dropped from PR 3. Superseded by Q9, which reports the
   same behaviour as a bug rather than a question.

### Needed for correctness, whenever

4. **Can a player be enrolled in two overlapping league seasons?** We render one season module and
   need to know whether that's a safe assumption or a bug waiting. `sections.mine` is an array and
   we can't find an overlap guard on enrolment.
5. **Is there any way to query "matches I've played but not scored"?** We can't find one. It's the
   third alert type and the only one with no data source.
6. **Can `GET /player/restringing/orders` be filtered by `fulfillment_status`,** or should we pull
   all and filter client-side for the ready-for-pickup alert?
7. **Can rankings be scoped to a court/club rather than a radius?** Rows already carry
   `court_locations[]`. "3rd at Penmar" is currently approximated as "3rd within N miles of Penmar",
   which is a different and less meaningful claim.
8. ~~**What sets `previous_rating`, and is there any dated rating history?**~~ **CLOSED** —
   traced. Every writer of the rating fields is enumerated in "Traced answers". There is no dated
   history table, so the windowed delta stays impossible and the delta stays cut.

### New, from the traces

13. **`filters.level` on `/player/discover/nearby` is a bug in its own right,** independent of the
   home page. It applies to **group lessons only** — coaches and open matches never receive it —
   as exact string equality on `metadata->>'level'` against free text like
   `"Beginner (NTRP 2.5)"`. An unrecognised value raises no error and returns **zero group
   lessons**. Anyone who wires a level control to this gets a silent empty state for a third of
   the feed. Needs a controlled vocabulary, range matching rather than equality, and coverage of
   the other two sections.

14. **`recomputeRatings()` writes a rating that blocks league enrolment — live bug, not a data
    cleanup question.**

    `recomputeRatings()` writes `current_rating = 0` to **every** non-deleted profile, including
    players who have never played, and runs from ordinary league and match-confirmation paths
    rather than as a migration.

    League eligibility resolves the player's rating as
    `usta_rating ?? self_rated_seed ?? starting_rating ?? current_rating`
    (`src/services/league_eligibility.js:45-50`). A zero there **satisfies** the `missing_rating`
    check and then **fails** `rating_out_of_band`.

    **1099 of 1142 unrated players are blocked from enrolling in any league by a value the rating
    engine wrote to profiles that have never played a match.** Only 43 have a `usta_rating` to fall
    back on; `uta_rating` is not consulted by the eligibility chain at all.

    This is not about tidying rows. Until it changes, league enrolment is closed to the majority of
    the player base, and the home page cannot honestly send anyone there.
---

# Verification against mockups

**Date:** 2026-08-15 · Read-only. Verified against `docs/cold.html`, `established.html`,
`in-league.html`, `decline-confirm.html`, `rated-no-bookings.html` (the seven states are one
template; these five cover every element).

## 1. Does the audit hold?

**Yes, with one real correction and a handful of field gaps.** The gap table's states are right,
the ratings-model conclusion is right, and the `rank`-under-geo-scoping bug is exactly the problem
the screens walk into. Every element on screen has a corresponding row except the off-court module
(explicitly out of scope) and the bottom tab bar. No audit row turned out to be dead. The one
substantive error is the rating delta: the audit recorded it as cut, and the screens render it.

## 2. Corrections

**The rating delta is back on screen.** `established.html` renders `6.4` with an up-arrow icon and
`0.2` inside the rating tile. The audit's §3 row 6 says the delta was cut and that cutting it was
correct — the second half still holds, but the first is now wrong.

Nothing changed server-side, so the tile is only satisfiable with one of two undocumented meanings:
`current_rating − starting_rating` (lifetime, since seed) or the gap to `previous_rating` (change
from the last match). Neither is a time window, and `0.2` with an arrow reads as recent movement.
**Ship it labelled ("since your last match") or not at all** — an unlabelled arrow implies a
recency the data doesn't have. VERIFIED.

**Ladder copy.** The screens say "3rd at Penmar" and "12th at Penmar". Per the audit, geo scoping
is a radius and `rank` is proximity-ordered under it. The honest copy the current data supports is
**"3rd nearby"** or **"3rd within 5 miles"**, computed client-side by re-sorting on
`current_rating`. "At Penmar" requires either a court/club filter on the ranking query, or ranking
only players whose `court_locations[]` includes that venue — which means "3rd among players whose
home court is Penmar", still not "3rd at Penmar". Recommend **"3rd nearby"** for v1.

**Decline confirm step.** `decline-confirm.html` reads "Decline this match? Mike will get a text
letting them know." That matches the verified behaviour exactly — `POST /invites/reject` sets the
status then SMSes the organiser with remaining open slots. **But the client cannot know whether the
SMS was sent:** the send is wrapped in its own `try/catch`, the error is swallowed, and the response
is always `{ message: 'Invite rejected' }`. So the copy promises a text that may silently not
arrive. VERIFIED.

## 3. Newly surfaced field requirements

| Element | Field needed | Source | Gap |
|---|---|---|---|
| Feed card time — "Today · 12:00 – 1:00 PM" | **end time** | — | v1 flagged end time missing on all card types. The screens require it |
| Feed card — "3 of 4 spots", "5 of 12 spots" | spots taken / capacity | group lessons have it | v1 flagged missing on several types, notably matches |
| Feed chips — All 59 / Lessons 31 / Groups 14 / Matches 14 | per-type counts | client-side from returned items | Counts are **post-filter** and must sum to the day-chip total, or they visibly disagree |
| Feed footer — "See all 59 this week" | window total | client-side count | Fine, but must match the "All" chip |
| Feed header — "Aug 2 – Aug 8" | window bounds | client-derived | Rolling 7-day, not calendar week — label it accordingly |
| Invite card — "Expires in 2 days" | `expires_at` | `GET /invites` | Present (v1 VERIFIED). Not previously listed |
| Rating tile — "Your rating settles after 3" | provisional/estimate threshold | `is_provisional`, `is_estimate` booleans only | **Thresholds are server config, never returned** (`src/config/rating.js:5-6`). A countdown needs the number, so the client would hardcode it and drift. Also note the copy says **3** = `estimateThreshold`, while `is_provisional` uses **5** — confirm which boundary "settles" means |
| Restring alert — "Tennis Garage · Penmar" | vendor name + vendor area | `GET /player/restringing/orders` | Vendor name INFERRED present; the **area/neighbourhood** string is UNKNOWN |
| Unentered score — "vs Sam Reyes · Thu 30 Jul" | opponent name + played date | — | Endpoint doesn't exist at all (audit row 2). The screen confirms the shape needed |
| Season module — "5 weeks left" | season end date | league record | INFERRED available |
| Season module — "5 of 8 matches played" | played + scheduled total | `/standings` | Total is field-size-derived; confirm it means *my* fixtures, not the field |
| Header — "Mar Vista" / "Venice" | neighbourhood | `court_area` on ranking rows | Audit row 12 UNKNOWN on the profile payload — still UNKNOWN |
| Cold — "Set your level · 2 minutes" | survey gate | `GET /player/surveys/answered` | Fine. Confirms the unrated CTA is the survey, distinct from the rated gate |

**Verified as assumed, no gap:** season module's "still to play Sam, Dan, Priya" maps cleanly to
`GET /leagues/{id}/result-opponents`; the bookings tile's count and "Next Sat 10 AM" are both
derivable from the three sources *(corrected — PR 1)*; the invite card's title/subtitle map to existing fields; the
`in-league` state confirms the alert stack and invite card are independently omissible.

## 4. Revised v1 verdict

**Still yes — but the feed needs two fields it doesn't have.**

Header, rating tile, bookings tile, today row and action grid are unchanged: all ship. The feed
ships **with visible holes** — cards render "12:00 – 1:00 PM" and "3 of 4 spots", and neither end
time nor match spots is reliably available. Options: drop the end time and spot counts from v1
cards, or get the fields added. That's a smaller change than it sounds, but it is a change, and the
audit's "nothing in v1 is blocked" was written without seeing those two lines.

The rating tile's delta is a **copy decision, not a blocker** — label it or drop it.

## 5. Additions to the Sahil questions

Genuinely new only; the existing eight stand.

9. **Can feed items carry an end time?** Cards render "12:00 – 1:00 PM" and only the start is
   reliably available across lesson, group and match types.
10. **Can match items carry spots taken/capacity** the way group lessons do? Cards render
    "3 of 4 spots" for match play.
11. **Can the rating thresholds be returned** alongside `is_provisional` / `is_estimate`? The tile
    says "settles after 3"; without the number the client hardcodes a value that drifts from
    `src/config/rating.js`.
12. **Does `POST /invites/reject` have any way to signal that the organiser SMS failed?** It's
    swallowed today and the response is always success — but the UI now promises the text explicitly.

---

# Traced answers — rating origin and the level filter

**Date:** 2026-08-16 · Read-only, `ttp-api` @ `main` `c205767`. Two questions that were waiting on
Sahil. **Both are now answered from the code, and one of them invalidates a decision already
shipped.**

## 1a. How a player gets a rating — none of (a), (b) or (c) as posed

**The profile does not write a rating** (VERIFIED). `player_profile.current_rating` is written in
exactly five production paths, and no questionnaire or profile save is among them:

| Writer | Trigger |
|---|---|
| `src/services/rating_engine.js:129` | a match result is processed |
| `src/services/league_enrollment.js:368` | league enrolment, seeded via `seedFromProfile` |
| `src/services/rating_replay.js:65` | `recomputeRatings()` — computed, for players with matches |
| `src/services/rating_replay.js:76` | `recomputeRatings()` — **seeded, for players without** |
| `routes/admin_players.js:273` | admin edit |

`routes/player_survey.js` contains zero rating references. So the "Set your level" premise is
false: **there is no two-minute route to a rating.**

### The part that matters more

`recomputeRatings()` (`rating_replay.js:44-88`) loads **every non-deleted profile** —
`listRatingSeeds` is `player_profile innerJoin users where is_deleted = false`, with no filter on
having played — and writes `current_rating` for *all* of them. Players with no matches get
`seedFromProfile(profile)`.

It is not a one-off migration. It is called from `routes/leagues.js`,
`src/services/match_result_auto_confirm.js`, `routes/admin_players.js`,
`routes/admin_leagues.js` and `routes/admin_match_results.js` — ordinary operations.

**So `current_rating` is non-null for essentially the whole player base.** VERIFIED against
production (`GET /match-results/rankings`, public, 2026-08-16):

- **1203** rows returned — every one has a non-null `current_rating`
- **1134** of them have `current_rating = 0`, `starting_rating = 0`, `matches_played = 0`
- **69** have a real rating (7.2, 8.19, …) with 3–10 matches played

The zero is not `seedFromProfile`'s default — that is 5.0 (`src/config/rating.js:7`) — so these
rows were zero-filled by an import or an earlier migration and have been carried forward by every
recompute since. Either way the effect is the same.

### Answer

Closest to **(c), but neither branch is the profile.** A rating arrives by playing a rated match,
by enrolling in a league, or by an admin action — never by completing a profile. And a *non-null*
rating already exists for ~94% of players at a meaningless zero.

### Implication — this breaks the gate as specified

**The rated gate must not be "has a non-null `current_rating`".** That is true for 1134 players
who have never played, and it would:

- open every rating-gated surface for them,
- render **"0.0"** in the rating tile,
- and place them in a 1134-way tie for ladder position.

The cold state would be unreachable for existing accounts. **A workable gate is
`matches_played > 0`, or `current_rating > 0`** — both are already on the ranking row. This
supersedes §3 row 10 and the gate PR 1 (#306) implemented.

Level-filtering the feed inherits the same problem: a player at zero has no meaningful level, so
level-based filtering can't key off the rating for most of the base.

## 1b. `filters.level` is honoured — narrowly, and unusably as things stand

**VERIFIED, traced end to end.**

`POST /player/discover/nearby` extracts it at `routes/player_lesson.js:1071`
(`filters.level || req.query.level || null`) and passes it to exactly **one** of the three feed
sections — `fetchUpcomingGroupLessons` (`:1171`). Coaches and open matches never receive it.

It reaches a WHERE clause (`models/player_lesson.js:583-590`):

```js
if (level && level !== "All") {
  lessonsQuery.andWhereRaw(`coach_lessons.metadata->>'level' = ?`, [level]);
}
```

- **Expects:** the exact stored string. `"All"` and null skip the predicate entirely, which is why
  today's hardcoded `"All"` is a no-op *by input*, not because the backend ignores it.
- **Unrecognised value:** no error — the predicate simply matches nothing, so group lessons come
  back **empty** while coaches and matches are unaffected.
- **The values are free text.** `src/api/groupLessons.ts:183-188` documents what the API actually
  returns: labels like `"Beginner (NTRP 2.5)"`, plus `"All"`, empty, and lesson-type fallbacks
  like `"Open Group"`. There is no controlled vocabulary, so a pill sending `"4.0"` matches
  nothing and silently empties one third of the feed.

### Answer

Honoured, but only for group lessons, only on exact string equality, against an uncontrolled
vocabulary. **Shipping a level control against this would silently empty part of the feed** —
recommend dropping it from PR 3, as the brief's fallback anticipates.

## Sahil questions now closed

- **Q3 — "Does `discover/nearby` honour `filters.level`?"** → closed by 1b. Yes, narrowly; not
  usable without a controlled vocabulary and coverage of the other two sections.
- **Q8 — "What sets `previous_rating`, and is there dated rating history?"** → partly closed:
  every writer of the rating fields is now enumerated above. No dated history table exists, so the
  windowed delta stays impossible.

Still open, and still his: Q1 (rank ordering under geo scoping), Q2 (timezone anchor), Q4
(multi-league), Q5 (unentered scores), Q6 (restring status filter), Q7 (court-scoped rankings),
Q9–Q12 from the mockup verification, plus the two added below.

**New for him:** Q13 (the level filter, restated as a bug) and Q14 (the 1134 zero-rated rows —
ongoing behaviour, not a one-off import).

---

# Traced answers — how a player can actually get rated

**Date:** 2026-08-16 · Read-only, `ttp-api` @ `main` `c205767`.

Prompted by the unrated state becoming the majority (1134 of 1203 accounts) with
"Join a league to get rated" as its only exit. **The verdict is (a): any confirmed match result
rates you, league or not — so the shipped CTA is wrong.** And it is worse than merely pointing at
one route among several; the league route is currently blocked twice over for exactly the players
who see it.

## Q1 — which match types produce a rating? Any of them (VERIFIED)

The rating engine's **only** input is `listConfirmedMatchResults`
(`models/match_results.js:20-35`): `match_results` where `status = 'confirmed'` and
`confirmed_at IS NOT NULL`. **No league filter — it does not even select `league_id`.**

- `POST /match-results/` (`routes/match_results.js:88`) requires no league;
  `validateMatchResultPayload` never mentions one.
- Confirming a result (`src/services/match_result_auto_confirm.js:61-68`) sets `status`,
  `confirmed_at`, then calls `recomputeRatings()`.

**So a casual/challenge match counts exactly the same as a league match.** Play anyone, log the
result, have the opponent confirm — rated. The client already has `/log-result`.

## Q2 — the two thresholds govern different things (VERIFIED)

| Constant | Value | Governs |
|---|---|---|
| `provisionalThreshold` | 5 | The K-factor. Under 5 matches the rating moves at `provisionalK` 0.8 rather than `k` 0.4 (`rating_engine.js:77-78`). Also sets `is_provisional` |
| `estimateThreshold` | 3 | Labelling only — sets `is_estimate`, and marks the NTRP/UTR equivalents an estimate (`rating_equivalents.js:61`) |

A player with **one** confirmed result is rated by our `matches_played > 0` gate and is
simultaneously `is_provisional` and `is_estimate` by the API's own reckoning. Not a contradiction,
but the tile would show a number the API itself calls an estimate — worth a design decision, not a
code one.

## Q3 — is a league open right now? Point-in-time, 2026-08-16, and it will change

**No, on two counts.**

**Status.** `GET /leagues` returns **5 available, every one `status: "draft"`**, all running
Sep 1 – Nov 30, all level-banded: Men's 3.5, Men's 4.0, Men's 4.5, Women's Intermediate (3.5–4.0),
Women's Advanced (4.0–4.5).

**Eligibility.** `league_eligibility.js:43-76` requires gender, date of birth, not underage, **and
a rating inside the league's band**. The rating resolves:

```
usta_rating ?? self_rated_seed ?? starting_rating ?? current_rating
```

Note `uta_rating` is **not** in that chain. For the zero-rated majority the chain resolves to
**0** — not null — so they clear `missing_rating` and then fail `rating_out_of_band`.

Of the 1142 players with no matches:

| | |
|---|---|
| have a `usta_rating` (the only usable fallback) | **43** |
| have `uta_rating` only — not consulted by eligibility | 30 |
| have neither | **1099** |

**So roughly 1099 of 1142 unrated players are ineligible for every level-banded league**, before
the draft status is even considered. The band values aren't exposed on the public league payload,
so the exact cut-off is **UNKNOWN** from outside — but a rating of 0 fails any positive lower band.

There is also a circularity worth naming: the leagues are level-banded, entry needs a level, and
the only thing that establishes a level is playing. A league cannot be the first step.

## Verdict — (a)

**Any confirmed match result rates you.** The league is one route among several, and currently the
least available one. The CTA shipped in #306 points unrated players at the single door they cannot
open.

**Proposed replacement copy — not changed, this is a design decision:**

> **Play a match to get rated** · Log the result and your opponent confirms

pointing at `/matches` (or `/log-result` for a match already played). That is the route actually
open to the players who see the prompt. League enrolment stays a valid route for the 43 with a USTA
rating, and becomes the better one once a season opens and the player has a level.

## For Sahil — extends Q14

The zero-rated rows aren't only a display problem. Because eligibility reads
`current_rating` as a fallback, a zero there actively **blocks league enrolment** with
`rating_out_of_band`. Whatever is decided about those rows, this is the concrete harm.
