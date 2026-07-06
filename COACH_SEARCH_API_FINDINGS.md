# Coach Search API — Findings (Find a Coach page)

Read-only investigation of the coach-search data surface, to decide which sort/filter
dimensions are real before designing the "Sort & filter" sheet. **No code was changed.**

Scope: the Find a Coach list at `/find-coaches` (`src/pages/FindCoaches.tsx`). All
line numbers below are from the files listed under "Files read".

---

## Summary table

| Dimension | Backing field on coach record | Server **sort**? | Server **filter**? | Verdict |
|---|---|---|---|---|
| **1. Distance / radius** | `distanceMiles: number \| null` | **No** ("Nearest" is client-side, page-only) | **Yes** — `radius` query param | **BUILD NOW** (radius filter is real; see sort caveat) |
| **2. Price / rate** | `hourlyRateValue: number \| null` (+ group/semi) | No (client-side, page-only) | No | **NEEDS BACKEND** (data present; no server sort/filter) |
| **3. Specialty / focus** | `specialties: string[]` (free-text) | n/a | No | **NEEDS BACKEND** (free-text, unverified source; no facet/param) |
| **4. Availability** | `availabilityWindows: string[]` (labels only; hardcoded fallback) | No | No | **NEEDS BACKEND / complex** (real availability = separate N+1 calls) |
| **5. Player level (NTRP) match** | **absent** (only `levels: string[]` free-text) | No | No | **CUT** (no coach NTRP field exists at all) |

> ⚠️ **Cross-cutting truthful-UI landmine:** *all* sorting is client-side over a **single
> page of 12 coaches** (`perPage: "12"`). "Nearest", "Top Rated", "Price ↑/↓" only reorder the
> 12 currently-shown coaches — not the full result set. Any sort control in the new sheet will
> silently mislead unless the endpoint gains a real `sort` param + we sort server-side.

> ✅ **Important correction (see §E):** the verdicts above describe the **discrete search-filter
> surface** (query-param filters + a sortable coach record). They do **not** mean the data
> doesn't exist. The **find-my-coach questionnaire** already matches coaches server-side on
> Level / Goals / Format / When (availability) / Budget (price) — so that coach-side data
> almost certainly **exists on the backend**. It's just not **exposed to the client** as
> discrete, filterable/sortable fields (the FE only gets an opaque match `score` + human-readable
> `reasons`). So most "NEEDS BACKEND" items are really "**expose what the recommender already
> uses**," not "build from scratch." This is the answer to "surely these must be on a coach's
> profile to filter?" — yes, server-side; no, not as client-filterable facets.

---

## A. Endpoint — request & response shape

### Request
Built in `fetchCoaches` (`FindCoaches.tsx:918`), issued via the low-level `services/api.js`
fetch wrapper (not an `api/` domain module).

- **Method:** `POST` (`FindCoaches.tsx:963`)
- **Path:** `player/getchecklocation` when signed in, else `public/coaches/search` (`:961`)
- **Base URL:** `VITE_API_URL` (`src/api/config.ts`); production preview points at
  `https://api.thetennisplan.com/api/`.

**Query-string params** (`URLSearchParams`, `:937–959`):

| Param | Source | Notes |
|---|---|---|
| `perPage` | hardcoded `"12"` (`:938`) | page size — drives the client-sort-only-12 problem |
| `page` | `String(page)` (`:939`) | pagination |
| `search` | `appliedSearchTerm.trim()` (`:940`) | free-text (name/specialty/court) |
| `radius` | `appliedRadius.toString()` (`:942`) | **the only real server-side filter** |
| `locationSearch` | conditional (`:956–959`) | set **only** when there's no numeric lat/lng AND a text location was typed |

**JSON body** (`:944–952`, sent `:967–969`):
```
{ position: { latitude, longitude, latitudeDelta: 0.25, longitudeDelta: 0.25 } | null }
```
lat/lng travel in the **body**, not the query string. `position` is `null` when no coordinate
is available (then the page shows an "enable location" error rather than searching — `:918–930`).

**Not sent to the server (searched, confirmed absent):** `sort`/`sortBy`, `price`, `specialty`,
`availability`, `level`/`ntrp`, and lat/lng-as-query-params.

**N+1 enrichment:** after the search returns, each coach is separately fetched via
`fetchCoachProfile(coach.id)` in `Promise.all` (`:987–996`, from `src/api/coachProfile`) — a
follow-up per-coach call, not part of the search request.

### Response — coach record (frontend type)
`CoachCardModel = Coach & {…}` (`FindCoaches.tsx:74`; base `Coach` from `src/data/mockCoaches.ts:19`).
Mapped from the raw payload by `mapCoachRecordToCard(record, i)` (`:472–620`), then optionally
overlaid by the detail-API profile in `mergeCoachProfileIntoCard` (`:394–470`).

Dimension-relevant fields and the **raw snake_case keys** the normalizer reads (defensively,
first-non-empty wins):

| FE field | Raw keys read (fall-through) | Ref |
|---|---|---|
| `hourlyRateValue` | `hourly_rate` → `price_private` → `pricing.hourly` → `pricing.private` → `recommendation.prices.private` → `price_per_hour` → `hourlyRate` → `rate` | `:499–508` |
| `groupRateValue` / `semiRateValue` | `group_rate`/`pricing.group`/…; `price_semi`/`pricing.semi`/… | `:511–516` |
| `specialties` | `specialties` → `speciality` → `specialty` → `tags` | `:535–537` |
| `availabilityWindows` | `availability_windows` → `availability_labels` → `available_times` → `availability`; **hardcoded fallback** `["Weekday Mornings","Weekends"]` | `:372–380` |
| `availableSlotCount` | **forced `null`** from search; only set later from detail-API `booking.availableDates[].totalSlots` | `:618`, `:396–464` |
| `distanceMiles` | `distance_miles` → `distanceMiles` → `distance` → `primary_location.distanceMiles` | `:550–555` |
| `levels` | `levels` → `focus_levels` → `skill_levels`; **hardcoded fallback** `["Beginner","Intermediate"]` | `:534`, `:592` |
| `rating` | `rating`/`review_score`/`rating_value`/`score` — **review score, not NTRP** | `:544–545` |

> ❗ **The raw keys above are largely speculative.** The normalizer reads many alternates
> defensively; there is **no in-file proof of which keys the backend actually returns**. We
> have not captured a live payload. Treat "backing field exists" as "the FE will *display* it
> *if* the backend sends one of these keys" — not as confirmation the data is populated.

---

## B. Per-dimension verdict

### 1. Distance / radius — **BUILD NOW** (filter), sort caveat
- **Field:** `distanceMiles: number | null` (`:550`).
- **Server filter:** **Yes.** `radius` is a query param (`:942`, from `appliedRadius`); changing it
  refetches (it's in `fetchCoaches` deps, `:1010`). No client-side distance filtering exists.
- **Server sort ("Nearest"):** **No.** Client-side JS sort on `distanceMiles` in the
  `filteredCoaches` memo (`:1142–1158`), over the 12-item page only.
- **Coordinates ("Current location" pill):** `position: Coordinates | null` sourced, in priority:
  (1) localStorage `player:web:user-location` (`getStoredLocation`, `userLocation.ts:18`), (2) browser
  `navigator.geolocation` via `requestCurrentLocation` (`:788–817`), (3) Google-autocomplete pick
  (`:1114–1122`). **`DEFAULT_POSITION` = LA `{34.0549, -118.2426}` (`userLocation.ts:8`) never reaches
  the search** — it only seeds the FilterMenu AddressPicker widget (`:1303–1305`). No coordinate ⇒ error
  state, not a default search. The pill label is the **hardcoded string** `"Current location"` set after
  geolocation (`:802`), persisted to `player:web:user-location-label`; the `isCurrentLocation` flag is
  stored but **not** used to render the pill (`:805`, `:748`) — so the label isn't a semantic
  "is this really the device location" check.

### 2. Price / rate — **NEEDS BACKEND**
- **Field:** `hourlyRateValue: number | null` present (`:499–508`); also `groupRateValue`, `semiRateValue`.
  (`semiRateValue` is captured but **not rendered** by `CoachSearchCard` — dropped at the card layer.)
- **Server sort:** No — `price_asc`/`price_desc` are client-side, page-only (`:1154–1155`).
- **Server filter:** No price/min/max param exists.
- To ship a trustworthy price sort or a price filter, the endpoint needs a `sort` and/or price-range param.

### 3. Specialty / focus — **NEEDS BACKEND**
- **Field:** `specialties: string[]` (`:535`), free-text labels from an unverified key.
- **Server filter:** No. FilterMenu does **not** expose specialty for coach search (see D).
- Needs a controlled facet (canonical specialty list) + a server filter param.

### 4. Availability — **NEEDS BACKEND / complex** (flagged)
- **Field on search record:** only `availabilityWindows: string[]` — **label strings**, with a
  **hardcoded fallback** (`["Weekday Mornings","Weekends"]`, `:379`), so a card can show availability
  text even when the payload carries none (truthful-UI risk). `availableSlotCount` is `null` from search.
- **Real "next available":** not in this endpoint. Computed by `useCoachNextAvailability`
  (`src/hooks/useCoachNextAvailability.ts`) which loops the next **7 days** and per day calls
  `getCoachScheduleById` + `getCoachLessonsById` (up to ~14 calls **per coach**) to find an open 1-hour
  slot. It's currently wired only into **My Coaches**, not the Find a Coach list.
- Server sort/filter: No. A real availability filter would need either the search response to carry
  structured availability, or an unacceptable N+1 across the whole list.

### 5. Player level (NTRP) match — **CUT**
- **Coach field:** **absent.** The only level-ish field is `levels: string[]` (`:534`) — free-text labels
  of levels a coach *teaches* (hardcoded fallback `["Beginner","Intermediate"]`), **not** a numeric NTRP or
  a min–max NTRP range. No `ntrp`/`previous_rating`/`division`/`band`/`utr` is read anywhere (grep-confirmed
  across `FindCoaches.tsx`, `CoachSearchCard.tsx`, `mockCoaches.ts`).
- **Current user's NTRP (to compare against):** **not verified** — not investigated here (would live in the
  player profile). Moot until a coach-side NTRP field exists.
- Not buildable without a new backend field. Effectively CUT for now.

---

## C. Query-params shape — atomic apply?

**Filters: yes (one request). Sort: not a server concern at all.**

- The server-backed inputs (`search`, `radius`, and body `position`/`locationSearch`) are assembled into a
  **single `params` object + one `api(...)` call** in `fetchCoaches` (`:937–971`). Changing search, radius,
  or location each re-runs that one request (all are `fetchCoaches` deps). So a sheet that edits the
  **real** server dimensions can **Apply in a single request**.
- **Sort is never sent to the server** — it's applied client-side after fetch (`:1142–1158`) and isn't even
  in `fetchCoaches`'s deps, so changing sort doesn't refetch.

**Consequence for the sheet:** "Apply" = **one** server request for the real filters (currently just
**radius** + search + location) **plus** a client-side re-sort of the returned 12. There is **no** combined
`sort + filters` params object today, because the endpoint accepts neither `sort` nor any of the
price/specialty/availability/level filters.

---

## D. FilterMenu — what's actually exposed for coach search

`FindCoaches.tsx:12` imports `src/components/FilterMenu/index.jsx` (NOT `findPlayers/FilterMenu.tsx`).
When `isCoachSearch` is true, the dynamic server-driven facets are **short-circuited** (`index.jsx:95–113`),
so `filtersData` stays `[]`. The only controls rendered are **Location** (AddressPicker), **Radius**
(slider 0–100 mi), and **Name** (free text) — `index.jsx:307–349`. Price / specialty / availability /
level / rating are **never** shown for coach search.

`onFilterChange` payloads (`index.jsx`): `{type:"location", value:{formatted_address, short_label, lat,
lng}}`, `{type:"name", value}`, `{type:"clear"}` (radius uses a separate `onRadiusChange`). `handleFilterChange`
(`FindCoaches.tsx:1108–1140`) maps these to **server** inputs (position / search / reset) — never client-side
list filtering.

---

## E. The find-my-coach questionnaire — the dimensions ARE matched server-side

A second surface I initially under-scoped, and it reframes everything above. FindCoaches renders
the coach-match **questionnaire** (`SimpleSurvey`, `FindCoaches.tsx:18`) — the "Your matches" /
`isMatchedMode` experience (`:1209–1210`).

**The wizard is backend-driven.** `SimpleSurvey` renders whatever questions the backend returns
(`/player/surveys/questions`, `playerHome.ts:452`); the FE does not hardcode them. It maps returned
questions to a summary by matching **question text** (`getCoachMatchSummaryItems`, `:638–658`):

| Wizard step | Matches question text containing | ≈ dimension |
|---|---|---|
| Level | "current level" | player's level (NTRP-ish) |
| Goals | "want to improve" | specialty / focus |
| Format | "prefer to learn" | private/group/etc. |
| When | "usually free" | availability |
| Budget | "budget per lesson" | price |

**Flow (all server-side matching):**
1. Player answers the survey → `buildSurveySubmissionPayload(answers, coachMatchQuestions)` →
   `submitSurveyAnswers` → **POST `/player/surveys/submit`** (`playerHome.ts:441`, `FindCoaches.tsx:1034`).
   Answers are stored server-side against the player.
2. Coaches are fetched from the **same** `/player/getchecklocation` search endpoint, but each record
   now carries a server-computed **`recommendation`** object → `score`, `reasons`, `prices`
   (`FindCoaches.tsx:474–475, 557–559`). The FE surfaces these as `matchScore` + `matchReasons`
   (human-readable chips like "Matches your level", rendered `:1452`).

**So, directly answering "these must be on a coach's profile to filter?":**
- **Yes — server-side.** The recommender ranks coaches by Level/Goals/Format/When/Budget and emits
  `reasons`, which is only possible if the backend holds structured coach-side data for them.
- **But not client-filterable.** The FE receives only an **opaque `score` + `reasons` strings** (plus
  `prices`), **not** the coach's structured level-range / specialty facets / availability windows. And
  the search **request** accepts none of these as filter params (only `radius`). The questionnaire is a
  **one-shot "tell us your prefs → ranked list"**, not toggleable filter chips.

**Design consequence for the "Sort & filter" sheet:** two different mechanisms are on the table —
(a) reuse the **survey/recommender** (already matches on all five, but as an opaque ranked list, not
chips), or (b) build **discrete filter/sort chips**, which needs the backend to expose the coach data
it *already matches on* as query params + structured record fields. Only **radius** supports (b) today.

---

## Open questions for Sahil (each needs a backend change or confirmation)

> Framing: per §E, most of these are "**expose the coach data the recommender already uses**" as
> discrete filter/sort params + record fields — not "create new data."

1. **Sort param.** Can the search endpoint accept `sort` (e.g. `distance | rating | price_asc | price_desc |
   match`) and sort the **full** result set server-side? Today sort is client-side over one 12-item page, so
   every sort option is misleading past the first page.
2. **Price.** (a) Which raw key is the *actual* hourly rate in the response — `hourly_rate`, `price_private`,
   `pricing.hourly`, `price_per_hour`, …? (b) Can we get a **price-range filter** param (min/max)?
3. **Specialty.** Is there a canonical specialty/focus vocabulary and a **filter param**? Current
   `specialties` is free-text from an unconfirmed key — not safe to build a facet on.
4. **Availability.** Can the search response include structured availability (a real next-available slot or an
   availability facet), so we avoid the per-coach 7-day `getCoachScheduleById` + `getCoachLessonsById` N+1?
   Also: are `availability_windows`/`availability_labels` *actually* returned, or is the FE showing the
   hardcoded `["Weekday Mornings","Weekends"]` fallback?
5. **NTRP.** Does a coach have an **NTRP range** (min/max) they coach? No such field exists today. If we want
   NTRP-match, the coach record needs it — and confirm where the **current player's** NTRP lives so we can
   compare.
6. **Live payload capture.** Please share a real `player/getchecklocation` / `public/coaches/search` response.
   The FE reads many speculative snake_case alternates; we can't confirm which fields are populated
   (incl. whether `availableSlotCount`, `distance_miles`, `group_rate`, etc. are ever sent).
7. **N+1 profile fetch.** Can the search response inline the fields currently pulled per-coach via
   `fetchCoachProfile`, to drop the follow-up N+1?

---

## Files read
- `src/pages/FindCoaches.tsx` — request build, normalizer, client-side sort, filter handling, coordinate sourcing
- `src/services/api.js` — the `fetch` wrapper that issues the request
- `src/api/http.ts`, `src/api/config.ts` — request helper defaults (GET default; method overridden to POST here) + base URL
- `src/components/FilterMenu/index.jsx` — filter controls + `onFilterChange` shape for coach search
- `src/data/mockCoaches.ts` — base `Coach` type
- `src/components/coaches/CoachSearchCard.tsx` — card props (what's actually rendered)
- `src/utils/userLocation.ts` — `DEFAULT_POSITION`, stored-location helpers
- `src/hooks/useCoachNextAvailability.ts` — the separate per-coach availability computation
- `src/pages/MyCoachesPage.tsx` — where the availability hook is actually used

_Investigation only — no application code changed; this is the only file created._
