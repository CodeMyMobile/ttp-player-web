# Backend readiness audit — home page redesign

**For:** Sahil / backend (CodeMyMobile)
**From:** Frontend (Paul)
**Status:** Audit — read-only investigation of the `ttp-player-web` frontend
**Date:** 2026-08-03

> **Scope & method.** The backend source is **not** in this repo — this is the player-facing
> frontend only. Every finding is scoped to what the frontend reveals (API client modules, TS
> types, hooks, network calls, git history) plus a few live reads of the one public endpoint
> (`GET /match-results/rankings`). Each claim is labelled **VERIFIED** (from an actual endpoint
> string or response type in the code / a live response), **INFERRED** (from frontend usage), or
> **UNKNOWN** (not determinable from the frontend). Where a response shape is UNKNOWN it is left as
> UNKNOWN rather than invented.
>
> **Branch caveat.** The audit was run on `feat/ladder-position-first`, which is **behind
> `origin/main`**. At least one home-relevant feature — the restring **pay-link checkout** (PR #290
> `restringPayLink`, merged to `main` 2026-08-03) — exists on `main` but not on this branch; findings
> for restring (row 7) reflect `origin/main`. Other post-branch merges to `main` were not
> re-audited; a re-scope against `main` is advisable before build.

---

## 1. Summary — can the redesign ship against today's API?

**Mostly yes — the majority of the home page can bind to endpoints that already exist**, but a
faithful build is blocked by a small, specific subset. The single biggest surprise reverses the
premise going in:

- **The rating tile is NOT the largest gap — it is largely READY.** There is **zero** evidence of
  Google Sheets / Apps Script / gviz / spreadsheet anywhere in the repo (VERIFIED — repo-wide
  search empty). TRP is delivered as live API fields: `current_rating` is **100%** populated on
  `/match-results/rankings` and `/player/personal_details`, and `rating_change` is **100%**
  populated and directional (verified `= current − previous`, 37 negative values in 1171 rows). The
  "+0.2" indicator's data already exists; the FE simply doesn't read it yet.
  *(Caveat: the backend's own upstream pipeline is invisible from here — it could compute TRP from a
  sheet before exposing it — but from the tile's perspective there is a real API contract to bind to,
  not a missing backend.)*

**The blocking subset — what genuinely cannot be built faithfully today:**

1. **Restring pickup alert has no player-scoped query.** A restring order model *does* now exist on
   `main` (PR #290, pay-link checkout) with a `fulfillment_status` state and a `vendor` object — but
   the only read is by pay-link **token** (`GET /restringing/pay-links/:token`, a walk-in `/pay/:token`
   page). There is **no "list this player's restring orders" endpoint** to drive a home alert.
   **(PARTIAL — model shipped, player-scoped list missing)**
2. **Unentered-score alert has no reliable backend flag.** "Played-but-unscored" is only approximated
   by a league-fixture heuristic that the code itself documents as imperfect; casual matches have
   nothing. **(MISSING)**
3. **The accept-invite side-effect chain is unverified** and sits behind a one-tap button — the FE
   POSTs `{token}` and never reads back whether a booking, notification, or pending-score record was
   created. **(UNKNOWN — must be confirmed before shipping the button.)**

> **Note on the invite card vs. open-feed split (corrected from an earlier draft):** the two UI
> treatments *are* separable today, by **endpoint**, not by a field. **Addressed-to-me** invites come
> from `GET /invites` — that list is structurally targeted (created by `sendInvites` with `playerIds`,
> the Challenge flow). **Open / anyone-can-claim** matches come from `GET /matches?status=open` +
> `isOpenMatch()` (`BrowseMatchesPage.tsx:601,669`; `api/matches.ts:421`), where open-ness is a match
> `visibility`/`type`/`is_open` property already read across the app. This is **not** a blocker — see
> row 1 for the small residuals (the home invite builder doesn't read visibility off `/invites` items,
> and it's UNKNOWN whether `/invites` ever mixes open invites into the addressed list).

Everything else (rating tile, league tile, next-session tile, activity feed) is **PARTIAL** —
buildable with frontend work and/or graceful degradation, but each carries caveats worth fixing
(NTRP backfill, multi-league handling, a "confirmed" flag for matches, a level filter, per-item
field gaps). Details below.

---

## 2. Gap table

Ordered by **how much UI each item blocks**, not by the order requested.

| # | Data need | Status | Endpoint(s) that exist | What's absent |
|---|-----------|--------|------------------------|---------------|
| 1 | **Match invites addressed to me** (card + feed) | **PARTIAL** | Addressed: `GET /invites` (`services/invites.js:65`), structurally targeted. Open/claimable: `GET /matches?status=open` + `isOpenMatch()` (`BrowseMatchesPage.tsx:601`; `matches.ts:421`). Accept `POST /invites/accept`, decline `POST /invites/reject` (`:70,78`) | **Card/feed split IS achievable** by endpoint (addressed=`/invites`, open=`/matches?status=open`); open-ness is a match `visibility`/`type`/`is_open` property already read app-wide — **not a blocker**. Residuals: home invite builder doesn't read visibility off `/invites` items (`DashboardPage.jsx:308`); UNKNOWN whether `/invites` ever mixes open invites in. **No `league_name`** (only `league_id` + `is_league_match` boolean). **No "propose alternative time" endpoint.** Not sorted soonest-first. **Accept side-effects UNKNOWN.** Raw `expires_at` + `start_date_time` *are* present (good). |
| 2 | **Alerts** (3-type stack) | **PARTIAL / MISSING** | Booking reminder derivable from upcoming-lessons calls; generic `GET /notification` (`api/notification.ts:98`) | **No aggregate alerts endpoint** — assembled client-side (`utils/homeAlerts.js`, union is only `invitation \| match_needs_players`). **Restring alert PARTIAL** — order model exists on `main` but no player-scoped list (row 7). **Unentered-score alert MISSING** (no reliable flag; league-only heuristic at `useLeagueDashboard.ts:540-546`). Three types = up to 3 round trips. |
| 3 | **Next confirmed session** (any type) | **PARTIAL** | Per-type: `GET /player/upcoming_lessons`; `POST /player/upcoming_group_lessons`; `GET /matches`; `GET /leagues/{id}/fixtures` | **No unified "next session" endpoint** — FE must fetch 4 sources and merge/sort by ISO time. Lessons have a numeric confirmed code (`status===1 && payment_status===1`, `groupLessons.ts:307-314`) but **matches have no clean "confirmed" boolean** — only `relationship`/participant `status`. Excluding pending invites needs explicit client filtering the current schedule builder doesn't do. |
| 4 | **Activity feed** ("Play this week") | **PARTIAL** | `POST /player/discover/nearby` (`playerHome.ts:194`) + `POST /player/upcoming_external_lessons` | Response **loosely typed** (no per-item type). **Per-day chip counts computed client-side** (`DashboardPage.jsx:1140`), not returned. Window is **rolling 7 days** (`moment()`…`+6d`), not calendar. **Level filter plumbed but hardcoded `"All"`** with no UI (`:977`) → same results for everyone. Distance is **server-supplied** (good) but **missing on external lessons**; **end time missing on all cards**; price/spots missing on several. Backend honoring of location/radius/level is UNKNOWN. |
| 5 | **League membership** (nullable tile) | **PARTIAL** | `GET /leagues` → `sections.mine[]` (`api/leagues.ts:242`); `GET /leagues/{id}/standings` (`:352`) | **No single membership+position call** — position/record/field-size are on the *standings* row, needing one `/standings` call **per league** + viewer identity-matching. **Multi-league is real** (`sections.mine` is an array; UI already pluralizes) — a one-league assumption is a bug. **Field size** is derived from `standings.length` (no `total_players` field). Nullable = **empty array** (not 404/null) — clean, but the top-level list *throws* on error, so distinguish "no league" from "fetch failed". |
| 6 | **Player rating** (TRP, change, NTRP, gate) | **READY (TRP/change) / PARTIAL (NTRP)** | `GET /player/personal_details` (`playerProfile.ts:60`); `GET /match-results/rankings`; survey gate `GET /player/surveys/answered` | TRP + change are live (100%). **`calculated_ntrp` only ~5% populated** → FE falls back to a client-side estimate (works, but flagged "estimated"). **`rating_change` window is undated/UNKNOWN** (what triggers a `previous_rating` snapshot?). Rated/unrated "gate" is **survey-completion** (readable) — but note survey completion ≠ "is rated"; the cleaner rated signal is a row in `/match-results/rankings`. |
| 7 | **Restring orders** | **PARTIAL** *(on `main`; not on this branch)* | `GET /restringing/pay-links/:token` → `{ order, vendor, account_link }`; `POST /restringing/pay-links/:token/checkout` (`src/api/restringingPayLinks.ts`, PR #290) | Order model **exists** with `fulfillment_status` (order state) + `payment_status` + a `vendor` object. **But read is token-only** (walk-in `/pay/:token`), so **no player-scoped "list my orders"** to power a home alert. `fulfillment_status` values not enumerated in FE (`string`). **Vendor has no `vendor_id`** — embedded object only, so multi-vendor grouping/filtering would need an id added (Stripe side is already per-vendor via `stripe_account_id`). |

---

## 3. Proposed contract (for what's missing)

Shapes below match existing conventions in `src/api/*` and the `docs/*-backend-brief.md` house style.
Each notes the endpoint it's patterned on. **These are proposals for discussion, not implemented.**

### 3.1 Invites — add a nullable league object; confirm addressed-only
*Patterned on the existing `GET /invites` list (`services/invites.js:65`).* The card/feed split does
**not** need a new discriminator — addressed invites are `/invites`, open ones are
`GET /matches?status=open`. The only additive ask is a nullable league **object** so we can show a
name instead of resolving an id:

```
GET /invites?status=pending&filter=pending
→ { invites: [ {
      token,
      sender: { id, full_name, profile_picture },
      league: { id, name } | null,             // NEW — null for Find-Players invites (currently only league_id)
      start_date_time,                          // raw ISO (already present)
      location_text, latitude?, longitude?,
      expires_at                                // raw ISO (already present — keep raw, FE formats)
  } ] }
```
Only if `/invites` is confirmed to *mix in* open/claimable invites would an `audience:
"addressed" | "open"` flag be needed; today the split is by endpoint (see Question 2).

### 3.2 Propose an alternative time
*No endpoint exists today (the Challenge UI promises it in copy only).* Patterned on
`POST /invites/accept` + the `createMatch` payload conventions:

```
POST /invites/{token}/propose
body: { start_date_time, location_text?, latitude?, longitude? }
→ { invite }   // updated invite, notifies the original sender
```

### 3.3 Accept-invite — no new shape, a **behaviour confirmation**
Not a new endpoint — I need the documented side-effect chain of `POST /invites/accept` (does it
create a booking, notify the sender, and/or create a pending score record?). This sits behind a
one-tap button; see Question 1.

### 3.4 Unentered-score alert — a "matches needing a score" query
*Patterned on `listMatches` filters (`api/matches.ts:1404`) + `GET /match-results/{id}`.* Either:

```
GET /matches?filter=needs_score
→ { matches: [ { id, opponent, played_at, location, ... } ] }
```
covering **both casual and league** matches (today only a league-fixture heuristic exists, and it's
self-documented as unreliable at `useLeagueDashboard.ts:540-546`).

### 3.5 Restring orders — a player-scoped list, reusing the shipped order model
The pay-link order model already exists (`RestringingPayLinkOrder`, PR #290). The home alert only
needs a **player-scoped list** of those same orders (today they're readable only by pay-link token).
*Patterned on the shipped `GET /restringing/pay-links/:token` summary + player list endpoints like
`GET /player/upcoming_lessons`.* Reuse `RestringingPayLinkOrder`/`RestringingPayLinkVendor`, adding a
`vendor.id` and an enumerated `fulfillment_status`:

```
GET /player/restring-orders?status=active
→ { orders: [ {
      ...RestringingPayLinkOrder,              // reuse the shipped shape (fulfillment_status, items, cents)
      fulfillment_status: "received" | "in_progress" | "ready_for_pickup" | "picked_up" | "cancelled",
      ready_for_pickup_at?,
      vendor: { id, name, address, phone, hours } // ADD vendor.id (today the object has no id) — multi-vendor
  } ] }
```
Two deltas vs. what shipped: (1) a **player-scoped** query (current read is token-only), and (2) a
stable **`vendor_id`** plus an enumerated `fulfillment_status` (currently a free `string`).

### 3.6 (Optional) Next confirmed session + aggregate home
*Optional but see §4.* A confirmed filter on existing lists, or a single normalized next-session:
```
GET /player/next-session
→ { type: "private"|"group"|"league"|"casual", title, start_date_time, location, ... } | null
```
And/or an aggregate to collapse the cold-load fan-out (patterned on the composition the FE already
does in `DashboardPage.jsx`):
```
GET /player/home
→ { rating, leagues[], next_session, invites: { addressed[], open[] }, alerts[], activity: {...} }
```

### 3.7 NTRP backfill — not a new endpoint
Backfill `calculated_ntrp` / `calculated_utr` across ranked players (currently ~5% coverage). The
fields and formulae already exist; they're just not populated. See Question 5.

---

## 4. Round trips

**Current home page cold load = 5 parallel calls** (VERIFIED, `DashboardPage.jsx:958-1004`):
`/player/upcoming_lessons`, `/matches`, `/player/discover/nearby`,
`/player/upcoming_external_lessons`, `/invites`. No aggregate endpoint exists (VERIFIED — no
`/player/home` or `/player/dashboard` in `src/api/`).

**A faithful redesign, as things stand, would need roughly 9–13 calls** on a cold load:

| Section | Calls |
|---|---|
| Rating tile | `/player/personal_details` + survey gate `/player/surveys/answered` = **2** |
| League tile | `/leagues` + `/leagues/{id}/standings` × N leagues = **1 + N** |
| Next session | `/player/upcoming_lessons` + `/player/upcoming_group_lessons` + `/matches` + `/leagues/{id}/fixtures` × N = **3 + N** |
| Invites | `/invites` = **1** |
| Alerts | `/notification` (+ score & restring endpoints once they exist) = **1–3** |
| Activity feed | `/player/discover/nearby` + `/player/upcoming_external_lessons` = **2** |

That's **~10 + 2N** requests, several of them fanning out per-league. **An aggregate
`GET /player/home` is worth asking for** — it would collapse this to one round trip and remove the
per-league N-fan-out and the client-side merging the FE does today. Recommended as a
fast-follow, not a launch blocker (the individual endpoints can ship the page first).

---

## 5. Questions for Sahil

Short and specific — the genuine unknowns:

1. **Accept-invite chain:** what does `POST /invites/accept` do server-side — create a booking,
   notify the sender, and/or create a pending score record? It's behind a one-tap button and the
   frontend can't see the effects.
2. **Invite scope + league name:** does `GET /invites` return **only** invites addressed to the
   specific player (i.e. is it safe to treat it as the "addressed to me" list, with open/claimable
   matches coming separately from `GET /matches?status=open`)? And can each invite carry a nullable
   `league: {id, name}` — today we only get `league_id` + an `is_league_match` boolean.
3. **Unentered scores:** is there any way to query a player's **played-but-unscored** matches
   (casual *and* league), or must we keep the league-fixture heuristic?
4. **Rating-change window:** what time window does `previous_rating` / `rating_change` represent,
   and what triggers a new `previous_rating` snapshot? We need this to caption the "+0.2" indicator
   honestly (it's currently undated).
5. **NTRP backfill:** will `calculated_ntrp` / `calculated_utr` be populated for all ranked players?
   Only ~5% have them today; the rest fall back to a client-side estimate.
6. **Discover filters:** does `POST /player/discover/nearby` actually honor `location` + `radius`
   (and a `filters.level`), and does it return `distance` server-side for **all** item types?
   External lessons currently come back with no distance and no price.
7. **Restring player-scoped list:** the pay-link order model exists (`GET /restringing/pay-links/:token`
   with `fulfillment_status`). Can we get a **player-scoped** `GET /player/restring-orders` returning
   those same orders (for the pickup alert), with an enumerated `fulfillment_status` and a stable
   `vendor.id`? What are the exact `fulfillment_status` values?

---

## Appendix — key files

- Rating: `src/api/playerProfile.ts:14-45`, `src/pages/PublicMatchResultsPage.tsx:14-34`, `src/utils/ratingConversions.ts:19-36`, `docs/trp-rating-conversion-backend-brief.md`
- Leagues: `src/api/leagues.ts` (`:242` list, `:352` standings, `:393` fixtures), `src/pages/LeaguesPage.tsx`, `src/features/leagueDashboard/useLeagueDashboard.ts`
- Bookings/invites: `src/api/matches.ts` (`:1404` listMatches, `:791` location, `:25-46` NormalizedMatch), `src/api/groupLessons.ts:284-314`, `src/services/invites.js`, `src/pages/DashboardPage.jsx:249-388`, `src/play-dates/components/ChallengeComposer.jsx`, `src/hooks/useChallenge.ts`
- Alerts/restring: `src/utils/homeAlerts.js`, `src/api/notification.ts`, `src/pages/log-result/data.ts`, `src/features/leagueDashboard/useLeagueDashboard.ts:540-546`; restring pay-link (on `main`, PR #290): `src/api/restringingPayLinks.ts`, `src/pages/PayLinkCheckoutPage.tsx`, route `/pay/:token` (`src/App.jsx:344`)
- Activity feed: `src/api/playerHome.ts:100-115,177-212`, `src/pages/DashboardPage.jsx:958-1152`
- Current home: `src/pages/DashboardPage.jsx`, `src/App.jsx:190-206,352`

---

## Addendum — live-diagnosis findings (Aug 2026)

Three diagnoses produced by live investigation (deployed bundle + live API) later in the same body
of work. Captured here so they aren't lost. Scoped to **deployed** behaviour (`origin/main` /
production) — which at the time was **ahead of** the branch the audit above was run on.

### A. Ladder "limited data on load, full on reset" — proximity scoping (deployed, PR #292 `update/ladderUI`)

**Symptom:** the live ladder (`thetennisplan.com/#/match-results`) shows a small subset on load; a
"Reset" gives the full list.

**Root cause (VERIFIED):** the deployed ladder — newer than both the audited branch and the earlier
`main` — calls `GET /match-results/rankings?near_lat=&near_lng=&radius_miles=` (a server-side proximity
filter neither older version had; `buildRankingsUrl`). On load it seeds `nearLat/nearLng` from
`getStoredLocation()` and `radiusMiles` from `getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES` (=10)
(`PublicMatchResultsPage.tsx` on `main`, `:337-339`, fetch `:461`). "Reset" clears location → bare call
→ all rows. Live counts: **bare = 1171; radius 10 = 69; 25 = 200; 100 = 206.**

**Two compounding causes (both server-side distance):**
1. **Wrong default center.** Same `radius=10` from **downtown LA** (`DEFAULT_POSITION` 34.0549,-118.2426)
   → **69**; from the **Westside** (Mar Vista 34.01,-118.43) → **190**; Santa Monica → **188**. The
   player base clusters Westside ~10–11 mi from the downtown default, so a 10-mile circle from downtown
   clips them right at the ~10.8-mile edge.
2. **Court-record duplication.** `distance_miles` is computed server-side to the player's **nearest**
   court (VERIFIED 209/210 rows). The same venue name yields wildly different distances (**Penmar 6.6–12.7
   mi; Mar Vista 6.6–10.9 mi**) because a venue exists as many court rows (**60 distinct court IDs named
   "Mar Vista"**) with inconsistent coords → boundary flips.

**Coverage ceiling:** even `radius=3000` returns only **~210 of 1171** — ~960 ranked players (seeded,
`matches_played=0`) have no court/coord and are excluded from every scoped view.

**Fix (frontend):** don't seed the center from the downtown default; make proximity opt-in or seed from
where the player actually plays; widen the default radius. Files (on `main`):
`PublicMatchResultsPage.tsx:337-339` (initial state), `:222-230` (`buildRankingsUrl`), `:461` (fetch),
`:326` (`radiusOptions [5,10,25,50]`). **Supersedes** `LADDER_POSITION_FINDINGS.md` (which said the ladder
had no geo param and backend scoping was UNKNOWN — proximity scoping has since shipped).

### B. Court location model — canonicalization + "home base" (design direction)

**Goal (from product):** two independent filter levels — (1) **radius by the player's home base**
(court-agnostic), and (2) **specific-court leaderboard** (venue membership: "how do I rank against
everyone who plays at this court").

**Venue canonicalization is the backbone.** The same physical venue exists as many Google `place_id`s /
court rows with differing coords (park centroid vs building vs courts). `place_id` keys "same Google
listing", not "same venue" — so a venue layer is needed via **coordinate clustering (~200–250 m)**, since
some capture paths store coords with no `place_id`. (60 court IDs named "Mar Vista".) The court
leaderboard already renumbers `rank` 1…N in filtered responses — correct for a court-local rank.

**Home-base source = match-profile preferred courts.** `TennisCourtPicker.jsx:25-42` captures lat/lng per
court (requires them) and submits them, **but the read model returns labels only** — `playerCourtLocations`
is a plain string array, no coords, no `place_id`. Coverage: required at profile completion → ~100% of
completers, **~46% of active players, ~15% of roster** (vs **~0%** for the general-location field). So
preferred courts are the best-covered home-base signal — once the coords are exposed.

**Backend asks (Sahil):** (1) persist + **return** per-preferred-court `lat/lng` (captured today, dropped
on read); (2) coordinate-cluster into a **canonical venue table** (`venue_id`, one coord, alias place_ids);
(3) ranking scopes — `near_lat/near_lng/radius_miles` **re-pointed to home base** (not nearest court) for
Level 1, and `?venue_id=X` for Level 2; (4) define "plays at" (match-count threshold — product decision).
Level 1's coverage is gated on home-base data; the canonical-court coord is the day-one fallback.

### C. Restring walk-in order — 500 `restringing_payment_link_base_url_missing`

**Symptom:** creating a walk-in order in the vendor app (`tennis-garage-vendor.netlify.app/orders/new`)
returns 500.

**Root cause (VERIFIED from response body):** `POST https://api.thetennisplan.com/api/vendor/restringing/walk-ins`
(same backend as the player app) returns `{"detail":"restringing_payment_link_base_url_missing"}`. Walk-in
creation generates the `/pay/:token` restring pay-link (PR #290) and throws because the payment-link
**base-URL config/env var is unset** in that environment. **Not a client bug** — payload is irrelevant;
the endpoint is auth-gated (403 without a token), so the 500 is a post-auth backend config error, which is
why every walk-in create fails identically.

**Fix (Sahil / ops):** set the restringing payment-link base URL (config key matches the error, likely
`RESTRINGING_PAYMENT_LINK_BASE_URL`) to the player-app origin (`https://thetennisplan.com`) in **every**
environment; ideally return a 400, not a 500, when it's missing. Lives in ttp-api
(`routes/restringing_pay_links.js`, `services/restringingPayments.js` per the pay-link plan doc).
