# Rating / Ladder API — findings (investigation only)

Scope: what the frontend can rely on for a **home-screen TPR (Tennis Plan Rating) strip**.
No app code changed. Cross-checked against the backend repo `CodeMyMobile/ttp-api`.

Frontend surface: **`src/pages/PublicMatchResultsPage.tsx`** (there is **no** `CompetitiveRatingCard.tsx` — that filename does not exist; the public ladder page is the only rating-list UI).
Backend: route `ttp-api/routes/match_results.js` (`normalizeRankingRow`, line 143; `GET /rankings`, line 171), query `ttp-api/models/match_results.js` (`listPlayerRankings`, line 171).

---

## 1. The endpoint

- **Path + method:** `GET /match-results/rankings` — confirmed. Called via raw `fetch(buildApiUrl("/match-results/rankings"))` (default GET, no auth header) in `PublicMatchResultsPage.tsx:101`.
- **Response envelope:** `{ rankings: Ranking[] }` (FE reads `data.rankings`, else `[]`).
- **Query params (server-side filters, both optional):** `gender`, `league`.
  - `gender` → `WHERE pp.rating_gender = ?`
  - `league` → `WHERE COALESCE(pp.rating_leagues,'') ILIKE %<league>%`
  - The FE does **not** pass either — it fetches the whole list and filters client-side (gender/league/search).
- **Ordering:** `ORDER BY pp.current_rating DESC, pp.full_name ASC`. Only players with `pp.current_rating NOT NULL` and non-deleted users are included.

---

## 2. Exact response shape (with alias drift flagged)

Backend `normalizeRankingRow(row, index)` emits **exactly** these fields:

| Response field | Type | Source / how derived | ⚠ Alias / drift notes |
|---|---|---|---|
| `rank` | number | `index + 1` | **Not stored.** Pure array-order rank (order = rating desc). FE re-derives `index+1` and ignores this field. |
| `user_id` | number \| string | `pp.user_id` | The player id (not account id). |
| `full_name` | string | `pp.full_name` | — |
| `current_rating` | number \| null | `Number(pp.current_rating)` | **Full precision** in the payload (DB numeric). Display truncates to **3 decimals** (`toFixed(3)`), but the raw value can carry more. |
| `starting_rating` | number \| null | `Number(pp.starting_rating ?? pp.self_rated_seed)` | Present in response but **absent from the FE `Ranking` type** (FE never reads it). |
| `previous_rating` | number \| null | `Number(pp.previous_rating)` | Present in response but **absent from the FE `Ranking` type**. |
| `self_rated_seed` | number \| null | `Number(pp.starting_rating ?? pp.self_rated_seed)` | **⚠ ALIAS COLLAPSE:** this is the *same* `seed` value as `starting_rating` — **not** the raw `pp.self_rated_seed`. If `starting_rating` exists, `self_rated_seed` returns `starting_rating`. Do not treat as the raw self-rating. |
| `rating_change` | number \| null | `Number((current_rating − seed).toFixed(6))` | **Since-start delta** (see §5). 6-decimal number; displayed at 3. |
| `matches_played` | number | `Number(pp.matches_played \|\| 0)` | Drives provisional/estimate. |
| `wins` | number | `pp.rating_wins` (aliased `as wins`) | **⚠** raw column is `rating_wins`. |
| `losses` | number | `pp.rating_losses` (aliased `as losses`) | **⚠** raw column is `rating_losses`. |
| `is_provisional` | boolean | `matches_played < 5` | **Computed** (`RATING_CONFIG.provisionalThreshold = 5`), not stored. |
| `is_estimate` | boolean | `matches_played < 3` | **Computed** (`RATING_CONFIG.estimateThreshold = 3`), not stored. |
| `usta_rating` | string \| number \| null | `pp.usta_rating` | Self-reported NTRP (passthrough). |
| `uta_rating` | string \| number \| null | `pp.uta_rating` | Self-reported UTR (passthrough). |
| `rating_gender` | "M" \| "F" \| string \| null | `pp.rating_gender` | — |
| `rating_leagues` | string \| null | `pp.rating_leagues` | Space-separated tags (e.g. `"sum45 s40"`). |

**Not present anywhere:**
- **No avatar / profile_picture field** at all (query doesn't select it; normalizer doesn't emit it). The UI uses **initials only**.
- `u.email` **is selected** in the query but **dropped** by the normalizer — never reaches the client.

**FE `Ranking` type (`PublicMatchResultsPage.tsx:7-23`)** is a *subset* of the response: it omits `starting_rating` and `previous_rating`. Confirmed names/types the task asked about:
- `current_rating: number | null` — displayed at **3 decimals**.
- `self_rated_seed: number | null` — but see alias-collapse warning above.
- `rating_change: number | null`.
- `is_provisional: boolean` (typed and returned, but the badge util ignores it — see §6).
- `user_id: number | string`.
- `rank: number` (typed, but **ignored** by render).
- name = `full_name: string`. **No avatar field.**

---

## 3. Rank & scoping

- **Rank = array order, not a stored value.** Both backend (`index+1`) and frontend (`RankingRow`/`RankingCard` use `index + 1`, ignoring `ranking.rank`) infer it from the rating-desc sort. There is no persisted rank/position column.
- **No location / nearby / geo scoping.** The only filters are `gender` and `league` (a text-tag match on `rating_leagues`). The list is **global** (all non-deleted players with a rating). A home strip cannot ask for "players near me" from this endpoint.

---

## 4. Per-user rating (own TPR without the full list)

- **No per-user endpoint exists.** `/match-results/rankings` returns the **entire** list only. To get the logged-in user's own row you must fetch the whole list and `.find(r => r.user_id === myPlayerId)` client-side. (`PublicMatchResultsPage` doesn't even highlight "you" — it's a public ladder with no self-marker.)
- **How the UI shows a user's rating today:** only inside **league context** — `LeagueDetailPage` Players tab renders `player.current_rating` from `getLeagueMatchNeeds`→`getLeaguePlayers` (`src/api/leagues.ts`, `LeaguePlayer.current_rating` / `LeagueStanding.current_rating`). Grep of `src/api/*` + `src/services/*` finds `current_rating` **only** in `leagues.ts` (plus the raw fetch in `PublicMatchResultsPage`). There is **no** profile/account API the FE uses that returns the user's TPR. (Note: the invite `inviter` profile we inspected earlier carried only `usta_rating`/`uta_rating`, **not** `current_rating`.)

---

## 5. Deltas & history

- **`rating_change` = `current_rating − starting_rating`** (where `starting_rating = pp.starting_rating ?? pp.self_rated_seed`). This is a **since-start / lifetime** delta (total movement from the seed), **not** last-match and **not** a time window.
- **All delta-relevant fields returned:** `rating_change` (since-start), `current_rating`, `previous_rating` (prior value), `starting_rating` / `self_rated_seed` (baseline). Note `previous_rating` is in the payload but **not typed/used** by the FE.
- **No time-windowed rating.** There is no weekly/monthly rating field, and **no dated rating/rank history** table or endpoint in this surface — only three point-in-time scalars (starting, previous, current) with no timestamps. You cannot build "TPR this week" or a sparkline from this API.

---

## 6. What the current component consumes

`PublicMatchResultsPage.tsx` → `RankingRow` (table) / `RankingCard` (mobile) read:
- `full_name` → text + `initials(full_name)` for a **colored-initials avatar** (`Avatar name index`; color from `AVATAR_COLORS[index % 6]`). **No image.**
- `rank` via `index + 1` → `<RankBadge rank>` (ignores the `rank` field).
- `current_rating` → `formatRating()` = `toFixed(3)` (or `"-"`). This is the **TPR** display.
- `rating_change` → `<ChangeValue>` = signed `toFixed(3)`; **green** if `>0`, **red** if `<0`, **grey** if `|Δ|<0.001` or null.
- `wins`, `losses` → `"{wins}-{losses}"`. `matches_played` → indirectly via `is_estimate`.
- `usta_rating`/`current_rating`+`rating_gender` → `estimateNtrp()`; `uta_rating`/`current_rating` → `estimateUtr()` (client-side derived NTRP/UTR when self-reported values absent).
- `rating_leagues` → `displayLeague()` (maps last tag via `leagueLabels`, else `"Open"`).
- `is_estimate` → `shouldShowEstimateBadge()` (`src/utils/ratingBadges.ts`) shows an **"Est."** badge. **Note:** the util checks **only `is_estimate`**, never `is_provisional`, even though it accepts both.
- **rating → label mapping:** there is no word-label ("Advanced" etc.). The only "label"-like outputs are the numeric TPR, derived NTRP/UTR chips, the league tag, and the boolean "Est." badge.

---

## Buckets

### ✅ CONFIRMED — available now from `GET /match-results/rankings`
- Global ranked list of all rated players: `user_id`, `full_name`, `current_rating` (TPR, full precision), `wins`, `losses`, `matches_played`.
- **Since-start delta** `rating_change` (signed number).
- `previous_rating` + `starting_rating`/`self_rated_seed` scalars (in payload; FE just doesn't type the first two).
- Flags `is_provisional` (<5 matches) and `is_estimate` (<3 matches).
- Self-reported `usta_rating` / `uta_rating`, `rating_gender`, `rating_leagues`.
- Server-side `gender` + `league` filters.

### 🔧 DERIVABLE — client-side from what's returned
- **The user's own row / TPR:** fetch the full list, `find(user_id === myPlayerId)`. (Player id = `user_id`, matching the `resolveMyPlayerId`/`user_id` convention used elsewhere.)
- **Rank number:** array index after the rating-desc sort (already how both ends do it).
- **Last-update delta:** `current_rating − previous_rating` (both fields returned; not currently exposed as a field or shown).
- **NTRP/UTR estimates:** `estimateNtrp`/`estimateUtr` already derive these client-side.
- **"You vs field" position, percentile:** computable from the full list once fetched.
- **NTRP/UTR display precision, colored delta, Est. badge:** all already client-formatted.

### ❌ MISSING — needs a backend change
- **A per-user rating endpoint** (e.g. `GET /match-results/rankings/me` or `current_rating` on a profile/dashboard payload) so a home strip doesn't download the entire global ladder to show one number.
- **Any geo/nearby scoping** (radius, "players near me") — only gender/league tag filters exist.
- **Time-windowed rating / rank** (weekly/monthly change) and **dated rating history** (for a trend/sparkline) — no history table or timestamps; only starting/previous/current scalars.
- **Avatar / profile image** on ranking rows — not selected or returned; today it's initials-only.
- **A stable stored `rank`** independent of the returned slice/filter (current `rank` is just the position within whatever list is returned).
- **`is_provisional` surfaced in the badge** (data exists; the shared `shouldShowEstimateBadge` util ignores it — a FE gap, not strictly backend).

---

### Home TPR-strip implication (summary)
A strip showing the user's **current TPR + since-start change + rank** is buildable **today** — but only by fetching the **full** `/match-results/rankings` list and filtering to `user_id` client-side (no per-user call, no geo). Anything **time-based** (this-week movement, trend line) or **nearby** is **not** possible without backend work. Avatar would be initials-only.
