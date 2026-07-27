# Ladder position-first redesign — investigation findings

Read-only investigation. No code was changed. All claims cite file:line as read on branch
`feature/flex-league-complete` (working tree includes the uncommitted PR-C/ladder revamp:
tappable rows, per-row Challenge, "Near my level" chip, bottom standing bar, podium removed).

Where the code cannot answer a question, the answer is an explicit **UNKNOWN — needs backend
(Sahil)**. No backend behaviour has been inferred or assumed.

---

## Summary

- **One endpoint feeds the ladder: `GET /match-results/rankings`, called with ZERO parameters**
  (`PublicMatchResultsPage.tsx:139`, `PlayerProfilePage.tsx:146`). It returns the **entire roster**
  (~1170 rows observed previously) as `data.rankings`. There is no paging, offset, cursor, or
  `aroundUserId` param anywhere.
- **No windowing is possible today.** A rank-centred window (±5 rows) can only be produced
  client-side by slicing the full array — the server cannot return a slice.
- **`rank` IS a real field on every row** (`PublicMatchResultsPage.tsx:13`). The standing bar uses it
  (`:188`); the visible table/cards instead render `index + 1` of the *filtered* array (`:458`,`:500`)
  — a deliberate display choice, correct only because the full list is always in memory.
- **Total ranked count is only derivable as `rankings.length`** (`:226`) — there is **no server total
  field read** and it's UNKNOWN whether one is even sent. Percentile is computable from `length`
  *only* because the whole roster is downloaded.
- **Limited RATING history exists; NO rank history.** `GET /player/personal_details` returns
  `starting_rating`, `previous_rating`, and `current_rating` for the **signed-in player**
  (`playerProfile.ts:26-28`) — enough for a rating trend/delta for the viewer, but **not on the ladder
  row** and **not dated** (so no "over 30 days" window). There is **no `previous_rank`/rank history**
  anywhere, and the league dashboard documents "no rank-movement history in the API"
  (`useLeagueDashboard.ts:305`). The ladder row's `rating_change` is typed but never read (window UNKNOWN).
- **Rating precision drops at display: TRP shown at `toFixed(3)`** (`:70`) — 3 decimals survive, so
  ~0.009 neighbour gaps do NOT collapse *today*. NTRP is `toFixed(2)`, UTR `toFixed(1)`. API/DB
  precision is UNKNOWN.
- **Provisional players are NOT held out** — `is_provisional` is typed but never filtered; provisional
  rows are interleaved. Only `is_estimate` drives a visual "Est." badge (`ratingBadges.ts:6`).
- **Gender/league/search/near-level filters are all client-side** over the global list; the list is
  **not re-ranked** when filtered — so global `.rank` and the filtered `index+1` diverge under a filter.
- **The "West LA Ladder" title is hardcoded copy** (`:252`); the query has no geo/region/club/radius
  param. Whether the backend scopes the roster server-side is UNKNOWN.
- **Challenge is fully functional**, reusing the private-match loop (`POST /matches` →
  `POST /matches/{id}/invites`). **No eligibility rules (rating band / cooldown / proximity / pending
  limit) are enforced client-side**; server-side enforcement is UNKNOWN.

---

## Can we build it?

| Design element | Verdict | Evidence |
|---|---|---|
| **1. Standing card** (rank, total, percentile, rating+trend, W–L, rank movement) | **PARTIAL — mostly FRONTEND-ONLY; rank-movement NEEDS BACKEND** | Rank (`.rank` field), rating, and W–L are present today. Total is only `rankings.length` from the full download (`:226`) — fine while the whole roster is fetched, but there's no server total (item 4). Percentile = FRONTEND-ONLY *given* the full roster. **Rating trend for the signed-in viewer IS supported** via `previous_rating`/`starting_rating` on `GET /player/personal_details` (`current − previous`) — but not from the ladder feed and undated (item 8). **"Rank movement over a window" is NOT SUPPORTED — needs backend**: no rank history, no dated snapshots (item 8). |
| **2. Centred ±5 window default** | **NEEDS FRONTEND WORK ONLY (today) / NEEDS BACKEND (to scale)** | The full sorted roster is already in memory (`:147`), so the client can find `myRow` and slice ±5 with no API change. But it still **downloads all ~1170 rows** to do it (item 2,3). A true server-side windowed endpoint (`aroundUserId`/offset) is **NEEDS BACKEND**. |
| **3. Rating gap vs each player** | **NEEDS FRONTEND WORK ONLY** | Every row carries `current_rating` (`:16`) at 3-decimal display precision; `myRating` is already derived (`:174`). Gap = simple subtraction client-side. Caveat: depends on API sending sub-0.01 precision (item 9, UNKNOWN at API layer). |
| **4. Provisional split (hold low-match players out)** | **PARTIAL — flag exists, behaviour is NEEDS BACKEND to be safe** | `is_provisional` and `matches_played` are already on each row (`:19,:22`), so the client *can* partition the list today. BUT whether `matches_played`/`is_provisional` reflect **confirmed completed** matches (vs forfeits/withdrawals/unconfirmed) is **UNKNOWN — needs backend** (item 10). Splitting on an unreliable count would mislabel players. |

---

## Findings (1–20)

### A. The ladder endpoint

**1. Endpoint path/method/shape.**
`GET /match-results/rankings` — the only ladder endpoint. Two call sites, both bare (no params):
- `src/pages/PublicMatchResultsPage.tsx:139` — `fetch(buildApiUrl("/match-results/rankings"))`
- `src/pages/PlayerProfilePage.tsx:146` — same.
Response is consumed as `data.rankings` (`PublicMatchResultsPage.tsx:147`:
`setRankings(Array.isArray(data?.rankings) ? data.rankings : [])`). Each row's frontend-typed shape
(`PublicMatchResultsPage.tsx:12-32`): `rank, user_id, full_name, current_rating, self_rated_seed,
rating_change, matches_played, wins, losses, is_provisional, is_estimate, usta_rating?, uta_rating?,
calculated_ntrp?, calculated_utr?, rating_gender?, rating_leagues?`.

**2. Windowing — the critical question.** **NOT SUPPORTED.** No `offset`, `page`, `cursor`,
`aroundUserId`, or any query param is passed at either call site (`PublicMatchResultsPage.tsx:139`,
`PlayerProfilePage.tsx:146`). The endpoint only ever returns from the top / the full set. Any
rank-centred window must be produced by slicing the fetched array client-side.

**3. Rows per call.** The **entire roster**, unbounded/not client-configurable. The whole array is
stored (`:147`) and its length is used directly as the player count (`:226` `players: rankings.length`).
Previously observed at ~1170 rows.

**4. Total count field.** **UNKNOWN — needs backend.** The frontend reads only `data.rankings` (an
array) and never extracts a `total`/`count`/meta field. The displayed count is `rankings.length`
(`:226`), i.e. the length of the downloaded array — reliable for percentile **only because** the full
roster is fetched. If the endpoint is ever paginated, percentile breaks unless a server total is added.

**5. Sort: server or client.** **Server-side (implicit).** There is no `.sort()` in the page; rows are
rendered in received order (`filtered.map(..., index)` at `:325`,`:340`) and rank is taken as the array
position (`index + 1`, `:458`,`:500`), which only makes sense if the server already returns rank order.
The frontend fetches the **full roster** (not a subset) to render — see item 3.

### B. Rank semantics

**6. Rank field vs index.** **BOTH exist, and they can disagree.** `rank` is a real response field
(`:13`) and is used by the standing bar: `rank: myRow.rank` (`:188`), displayed `#{myStanding.rank}` (`:373`).
The visible **table/cards ignore it** and compute `const rank = index + 1` on the *filtered* array
(`:458` desktop, `:500` mobile), passed into `RankBadge` (`:445` area). This is safe only while the full
list is present and unfiltered. **Flag:** under an active gender/league filter the table shows filtered
positions (`index+1`) while the standing bar shows the true global `.rank` — they diverge (see item 11).
For a position-first redesign, prefer the `.rank` field everywhere.

**7. Own rank — direct or scan.** **Client scans the list to find itself.** No "this is you" field is
returned. `buildViewerIdentities(user)` (`:92-104`) collects the viewer's id/name/email variants;
`matchesViewer()` (`:106-107`) tests a row; `myRow = rankings.find(... matchesViewer ...)` (`:171`).
The standing bar then reads `myRow.rank` (`:188`). (Note the identity match is needed because the auth
account id is not in the ranking `user_id` space — matching falls back to name/email.)

**8. Historical rank/rating.** **CORRECTION to an earlier draft: limited RATING history DOES exist for
the signed-in player; RANK history does not, and neither is dated.**
- **Rating history (viewer only):** `GET /player/personal_details` returns three rating points for the
  signed-in user — `starting_rating` (seed), `previous_rating` (prior), `current_rating`
  (`src/api/playerProfile.ts:26-28`; token-only, own-player endpoint at `:87-97`). This is enough to
  show a **rating trend/delta for the viewer**: `current − previous` ("since last update") or
  `current − starting` ("since seed"). `starting_rating` also returns in league-enrollment `seeding`
  (`src/api/leagues.ts:198-201`) and is the ONLY one consumed today
  (`src/features/leagueJoin/LeagueJoinSuccess.tsx:94`, `LeaguePaymentStep.tsx:144`); `previous_rating`
  is typed but currently unread.
- **Not on the ladder row / not for opponents:** these fields are on the profile-details type, **not**
  the ladder `Ranking` type (`PublicMatchResultsPage.tsx:12-32`). The ladder feed cannot show a trend
  for arbitrary other players. The "other player" endpoint `GET /player/profile/{userId}`
  (`playerProfile.ts:77-80`) is loosely typed (`[key: string]: unknown`) so MAY carry these for others —
  **UNKNOWN — needs backend** to confirm.
- **No timestamps / no series:** `previous_rating`/`starting_rating` are single prior values with **no
  dates** — there is no dated snapshot or time-series endpoint. A specific **"rank/rating movement over
  30 days"** window is therefore **NOT SUPPORTED — needs backend**.
- **No rank history at all:** grep for `previous_rank`/`prior_rank`/`rank_change`/`rank_delta` is empty
  across `src/`. Only *rating* has prior values; **rank movement is unsupported**. Corroborating:
  `src/features/leagueDashboard/useLeagueDashboard.ts:305` —
  `// NOTE: no rank-movement history in the API → always flat (renders "–")`, hardcoding
  `trend: { dir: "flat" }`.
- The ladder row's `rating_change` field (`:18`) is typed but **never read or rendered** (grep:
  type-only); its meaning/window is **UNKNOWN — needs backend**.

**9. Rating precision per layer.**
- **DB:** not visible — **UNKNOWN — needs backend.**
- **API response:** not typed/asserted; cast straight to `Ranking[]` (`:147`) — **UNKNOWN — needs backend.**
- **TS type:** `current_rating: number | null` (`:16`) — no decimal constraint.
- **Display:** `formatRating` → `toFixed(3)` for TRP (`:68-71`, used `:479`,`:515`); NTRP `toFixed(2)`
  (`ratingConversions.ts:21,26`); UTR `toFixed(1)` (`ratingConversions.ts:32,35`).
- **Risk:** neighbour gaps ~0.009 TRP survive at 3-decimal TRP display, so the *rating column* won't
  collapse ties today. **But if the "gap" feature or any tie-break rounds to 2 decimals it will**, and
  it's UNKNOWN whether the API even sends 3+ decimals (it could round upstream).

**10. Completed match count.** `matches_played` (`:19`), `wins` (`:20`), `losses` (`:21`) are present.
**Whether these are confirmed-completed matches vs including forfeits/withdrawals/unconfirmed scores is
UNKNOWN — needs backend.** No `is_confirmed`/`match_status` field exists on the row to distinguish them.
The provisional split (design #4) depends on this being a trustworthy completed count.

**11. Filter interaction — global rank vs filtered list.** **Filtered client-side; NOT re-ranked.**
`filtered` (`:211-222`) applies gender (`ranking.rating_gender`), league (`matchesLeague`), search, and
near-level over the full in-memory roster; the server is never re-queried on filter change. Rows keep
their global `.rank` field but the table prints `index+1` of the filtered subset (`:458`,`:500`). So
**while a filter is active, the table's visible position and the standing bar's global rank disagree**
— a real correctness gap the redesign must resolve (decide whether ranks are global or per-filter).

**12. NTRP~ source.** **Derived client-side.** `estimateNtrp(ranking)` (`:73-74`) calls
`deriveNtrp(ranking.calculated_ntrp ?? ranking.usta_rating, ranking.current_rating, ranking.rating_gender)`.
Definition `src/utils/ratingConversions.ts:19-27`: prefers a direct backend value
(`calculated_ntrp`, else `usta_rating`) when in (0,7]; otherwise estimates from TRP:
`base = gender === "F" ? 4.5 : 5.0; ntrp = clamp(2.5,6.0, round4((3.5 + (trp - base) * 0.5)))`, then
`toFixed(2)`, flagged `estimated: true`. So NTRP is a stored field when the backend provides one, else a
client estimate.

**13. Location/geo scoping.** **No client-side scoping.** The query has no region/city/club/radius param
(`:139`). The heading `West LA Ladder` is a static string (`:252`), not derived from response or user
location. **Whether the backend scopes the roster server-side (fixed config/session) is UNKNOWN — needs
backend.** As written, the frontend treats the endpoint as global.

### C. Existing frontend

**14. Route + component tree.** Routes `/match-results` and `/ladder` (`src/App.jsx:344-350`) →
`src/pages/PublicMatchResultsPage.tsx` (528 lines). Tree: `MainLayout` → header (`:252`) → filter block
(`FilterRow`/`FilterButton`) → desktop `<table>` of `RankingRow` → mobile list of `RankingCard` →
conditional bottom standing bar (`:365-382`).

**15. Row component + reuse.** `RankingRow` (`~:445-485`) and `RankingCard` (`~:487-527`) are **defined
locally** in `PublicMatchResultsPage.tsx` and used **only** there (grep across `src/` finds no other
consumer). Desktop table + mobile card are two components sharing the same props
(`ranking, index, isMe, onOpen, onChallenge`). **Not shared** — safe to change without affecting other
pages.

**16. Standing / sticky bar.** Rendered `:365-382` (fixed bottom container). Gets the user's rank from
`myRow` (`:171`, identity-matched — item 7), builds `myStanding` (`:186-193`) with rank/rating/ntrp/record.
Scroll via `jumpToMe()` (`:195-201`) → `scrollIntoView({behavior:"smooth", block:"center"})` on the
element whose id is `ladder-me-desktop` / `ladder-me-mobile`, set conditionally on the row (`:461`) and
card (`:502`) via `id={isMe ? ... : undefined}`.

**17. Filter block wiring.**
- "Near my level" chip: shown only when `canNearMyLevel` (`:265`), toggles `nearMyLevel` (`:267-268`).
- Gender: hardcoded All/Men/Women (`:271-274`), filters `ranking.rating_gender` (`:214`).
- **League: dynamically derived from the response** (`:203-209`) — a `Set` of `rating_leagues` tags
  intersected with `leagueOrder`, rendered as buttons (`:278-282`). **Not** a single hardcoded "All".
- **All filters are client-side** (`filtered` useMemo `:211-222`).

**18. Loading / empty / error / user-absent.**
- Error: `:306-307`. Loading: `:308-309` ("Loading rankings…" + spinner). Empty (post-filter):
  `:352-354` ("No players match these filters.").
- **User not in ladder:** degrades gracefully — the standing bar only renders when `myStanding` is truthy
  (`:365`), which is null when `myRow` isn't found; `isMe` gating means no "You" tag/highlight appears
  (`RankingRow` ~`:472`, `RankingCard` ~`:509`). Logged-out users simply see no bar. There is **no
  explicit "you're not ranked yet / play N matches to appear" affordance** — an opportunity for the
  redesign given the provisional concept.

### D. Challenge flow

**19. Challenge flow — functional, reuses the private-match loop.** Not a stub. Entry:
`startChallenge()` on the ladder (`PublicMatchResultsPage.tsx:235-242`) and a Challenge button on the
profile (`PlayerProfilePage.tsx:714`), both calling the `useChallenge()` hook (`src/hooks/useChallenge.ts:16-36`),
which gates entitlement + auth then `navigate("/matches", { state: { openNewMatch: true, challengeOpponent } })`.
`src/App.jsx:280` forwards `location.state?.challengeOpponent` into the matches app;
`src/play-dates/TennisMatchApp.jsx:1299-1300` captures it as `challengeTarget` and `:6843-6859` renders the
dedicated `ChallengeComposer`. `ChallengeComposer` (`src/play-dates/components/ChallengeComposer.jsx:45-223`)
collects when/court/note, format fixed to **Singles**, then calls **two existing endpoints** in sequence
(`:155-159`): `createMatch(payload)` → `POST /matches` (type `private`) and
`sendInvites(matchId, { playerIds:[opponentId], phoneNumbers:[] })` → `POST /matches/{id}/invites`
(`src/play-dates/services/matches.js:34,410`). **There is no dedicated `/challenge` endpoint** — it reuses
the private-match create + single-invite loop.

**20. Eligibility rules.** **None enforced client-side.** `canChallenge()`
(`src/utils/challengeEntitlement.ts:10-12`) currently `return true` for everyone (a stub for a future paid
gate). The hook's only guard is that gate + a sign-in prompt (`useChallenge.ts:22`). `ChallengeComposer`
validates form completeness + a finite opponent id only (`ChallengeComposer.jsx:118-132`). **No rating
band, rank-proximity limit, cooldown, pending-challenge cap, or self-challenge guard exists in the
frontend.** Whether `POST /matches` / `POST /matches/{id}/invites` enforce any server-side eligibility is
**UNKNOWN — needs backend.** No band value is defined anywhere in the code — do not assume one.

---

## Open questions for Sahil

1. **Windowed ranking:** Can `GET /match-results/rankings` gain an `aroundUserId` (or `offset`+`limit`,
   or `cursor`) parameter to return a slice centred on a given player's rank, plus a **`total` ranked
   count** in the response? (Needed for a ±5 default window without downloading all ~1170 rows, and for
   percentile once the full download stops.)
2. **Rank movement / trend:** The profile endpoint already exposes `previous_rating`/`starting_rating`
   for the signed-in user (undated). Can you (a) add `previous_rating`/`previous_rank` to the **ladder
   ranking row** so trend can show for every player, (b) add a **dated** snapshot/history so a real
   "over 30 days" window and a rank-movement arrow are possible, and (c) confirm what the ladder row's
   `rating_change` field means and over what window?
3. **Rating precision:** To how many decimals is TRP stored and **sent in the API response**? (Neighbour
   gaps are ~0.009; a "gap" column needs at least 3 decimals from the API, not just at display.)
4. **Completed-match count:** Do `matches_played` / `wins` / `losses` count only **confirmed, completed**
   matches, or do they include forfeits, withdrawals, or unconfirmed scores? What is the exact rule that
   sets `is_provisional`? (Design #4 partitions the ladder on this.)
5. **Filter ranking:** When filtering by gender or league, should ranks be the **global** rank or a
   **re-ranked** position within the filtered cohort? Can the backend return per-cohort ranks, or should
   the frontend recompute?
6. **Geo scoping:** Is the `/match-results/rankings` roster globally unscoped, or already scoped
   server-side (e.g. "West LA")? If it should be regional, how is the region selected (session, param,
   account)?
7. **Challenge eligibility:** Are there (or should there be) server-enforced eligibility rules for
   initiating a challenge — a rating band, rank proximity, cooldown, or pending-challenge cap? If a band
   is desired, what are the exact bounds?

---

## Risks and constraints

- **Client-side rank via `index+1` vs the `.rank` field (items 6, 11).** The visible table/cards derive
  rank from filtered array position, which is only correct on the full unfiltered list. Under any active
  filter, the table position and the standing bar's global `.rank` diverge. A position-first redesign
  should standardise on the `.rank` field (or an explicit per-cohort rank from the backend) and stop
  using `index+1`.
- **Whole-roster download (items 2–4).** Everything currently works *because* all ~1170 rows are fetched
  and held in memory: total count, percentile, self-lookup, and any ±5 window are all client-side over
  the full array. This scales poorly and silently breaks the moment the endpoint is paginated — the
  redesign's dependence on "the whole list is present" is a hidden coupling to call out.
- **Partial history / no rank movement (item 8).** A rating trend for the *signed-in viewer* is
  buildable from `previous_rating`/`starting_rating` on `/player/personal_details`, but it's undated,
  not on the ladder row (so no per-opponent trend), and there is **no rank history at all** — the league
  dashboard already ships rank movement as permanently "flat" for this reason. Descope per-opponent
  trend, exact time-windows ("30 days"), and rank-movement arrows, or block on new backend history.
- **Precision loss risk (item 9).** TRP survives at 3-decimal *display*, but API/DB precision is
  unconfirmed. A gap column or tie-break that rounds to 2 decimals would collapse adjacent players into
  false ties. Verify the API sends enough precision before relying on gaps.
- **Provisional data trust (item 10).** `is_provisional`/`matches_played` exist but their reliability
  (forfeits? unconfirmed?) is unconfirmed. Splitting the ladder on an untrustworthy count would
  mislabel players as ranked/provisional.
- **Identity matching is heuristic (item 7).** "You" is found by matching id **or** name **or** email
  because the auth account id isn't in the ranking `user_id` space. A common name could mis-match or
  fail to match, leaving a signed-in player with no standing card. A reliable "this row is you" signal
  from the backend would remove this fragility.
- **Shared challenge/match backend, not a shared component.** `RankingRow`/`RankingCard` are local
  (safe to restyle), but the Challenge action reuses the general `POST /matches` + `/invites` loop
  (`ChallengeComposer` is a dedicated UI over a shared backend). Any challenge eligibility rule must be
  added without disturbing the general private-match flow.
