# Match-profile vs rating stores — investigation findings

Read-only investigation. No code changed. Cites `file:line` as read on branch
`feat/ladder-position-first`. Where the code can't answer, the answer is an explicit
**UNKNOWN — needs backend (Sahil)** — no backend behaviour has been inferred.

Companion to `LADDER_POSITION_FINDINGS.md` and `COURT_DATA_FINDINGS.md`.

---

## Summary

A player's **gender** and **level/rating** are held in **three independent stores**, each with its
own field names, write path, and read model. **The frontend reconciles nothing at the data
layer** — the only cross-references are display-time fallbacks. So the stores can silently
disagree, and the ladder must rank/filter on the rating store alone.

| Store | Fields | Written by (FE) | Read on |
|---|---|---|---|
| **Match-profile SURVEY** | `gender`, `skillLevel` (+ courts, availability, lookingFor) | `submitSurveyAnswers → POST /player/surveys/submit` | suggested-player / `/public/players/{id}` record |
| **ACCOUNT** | `gender`, `usta_rating` | `patchPlayerPersonalDetails → PATCH /player/personal_details` — **only** from `LeagueJoinReviewSheet.tsx:282` | `/player/personal_details` |
| **RATING** (backend-derived) | `rating_gender`, `self_rated_seed`, `self_rating_source`, `seeded_at`, `current_rating`, `calculated_ntrp` | **never written by the FE** | ranking row + `/player/personal_details` |

---

## 1. Survey mechanism consumers

The `getAllSurveyQuestionAnswered` / `submitSurveyAnswers` / `getAllSurveyQuestion` trio is used
**only for the match profile**. Every consumer:

- `src/pages/PlayerMatchProfileEditPage.tsx` — `getAllSurveyQuestion` (`:70`),
  `getAllSurveyQuestionAnswered` (`:60`), **`submitSurveyAnswers`** (`:114`). Full-page editor.
- `src/components/players/MatchProfileModal.tsx` — `getAllSurveyQuestionAnswered` (`:368`),
  **`submitSurveyAnswers`** (`:482`). Modal editor.
- `src/pages/PlayerMatchProfilePage.tsx` — `getAllSurveyQuestion` (`:50`),
  `getAllSurveyQuestionAnswered` (`:51`). Read-only display (no submit).
- `src/pages/FindPlayersPage.tsx` — `getAllSurveyQuestionAnswered` (`:861`). Completeness gate
  only (`hasIncompleteMatchProfileQuestions` + hydrate a local `StoredMatchProfile`); no submit.

**Not the same thing:** the **coach-match survey** is a parallel but distinct endpoint set —
`getCoachMatchSurveyQuestions` / `submitCoachMatchSurveyAnswers` / `clearCoachMatchSurveyAnswers`
(used by `FindCoaches.tsx`). `SimpleSurvey`/`AddressPicker` are generic components reused by both,
but the match-profile survey trio above is match-profile-only.

## 2. Are survey gender/level the same store as `rating_gender`/`usta_rating`/`self_rated_seed`?

**No — independent stores that can disagree, with no FE reconciliation.**

Proof they're distinct, all on one type — `PlayerPersonalDetails` (`src/api/playerProfile.ts:14-45`):
- carries `gender` (`:25`) **and** `rating_gender` (`:32`) as separate fields;
- carries `usta_rating` (`:23`) **and** `self_rated_seed` (`:29`) as separate fields;
- the PATCH body `PatchPlayerPersonalDetailsBody` (`:47-58`) can write `gender`/`usta_rating` but
  **not** `rating_gender`/`self_rated_seed` — those are backend-seeded.

**How they diverge in practice:**
- The ladder gender filter uses **`rating_gender` only** (`PublicMatchResultsPage.tsx:324`), while
  Find Players filters on the **survey `gender`** (`FindPlayersPage.tsx:1388`). Same player can
  filter differently across the two pages if the two genders diverge.
- Ladder position is driven by **`current_rating` (TRP)**, seeded from `usta_rating`/
  `self_rated_seed` at **league join** — *not* by the survey's `skillLevel`, a display-only
  self-declared NTRP string that never touches ladder rank.

**Reconciliation — none at the data layer.** The only cross-references are display-time fallbacks,
never write-backs:
- `readViewerNtrp` (`PublicMatchResultsPage.tsx:120-123`): `skillLevel ?? usta_rating ?? …` —
  anchors "Near my level" for a viewer with no ranked TRP.
- `deriveNtrp(calculated_ntrp ?? usta_rating, current_rating, rating_gender)` for the displayed NTRP.

No FE code writes survey gender/level into the rating store or vice-versa. Whether the **backend**
syncs any of these (survey `gender` → `rating_gender`, or account `usta_rating` → the seed) is
**UNKNOWN — needs Sahil**. The `self_rating_source` field (`playerProfile.ts:31`) suggests the
backend tracks seed provenance.

## 3. Match-profile survey questions — structured vs free text

**Caveat:** the question set is **backend-driven** (`GET /player/surveys/questions`, **403 without a
token**) and there are **no survey fixtures in the repo**, so the exact live list is
**UNKNOWN — needs Sahil**. Below is the set the app **explicitly recognizes and consumes**, inferred
from the label-matching in `buildMatchProfileFromSurvey` (`src/utils/matchProfile.ts:166-181`), the
suggested-player record fields (`src/utils/suggestedPlayer.ts`), and Find Players' filters. Any other
backend question renders generically via `SimpleSurvey` and is not specially consumed. Matching is by
question **text**, not a stable `question_code` — itself fragile.

| Question (matched by label) | Output field | Structured or free text |
|---|---|---|
| About / background / bio | `about_me` | **Free text — display only** |
| NTRP / level | `skillLevel` → `level` | **Structured** — parsed `/NTRP ([0-9.]+)/` (`suggestedPlayer.ts:51`), filtered in Find Players (`:1382`), anchors "Near my level" |
| Gender | `gender` | **Structured** — normalized Male/Female/Other, filtered in Find Players (`:1388`) |
| Gender "other" detail | `genderAdditionalText` | **Free text — display only** |
| Preferred / local / closest tennis court | `playerCourtLocations` / `localCourts` | **Semi-structured label** — venue-label array; drives location fallback + display; coords captured at pick then discarded on read |
| General location | `playerLocations` | Captured **with** coords but **not mapped into the profile and 0% populated** — effectively unused |
| Availability / times of day | `availability` | **Structured** — canonicalized, filtered in Find Players (`:1397`) |
| Looking for / play style / play type | `lookingFor` / `playStyles` | **Structured** — tag array, shown as chips |

`SimpleSurvey` also handles `NumericInput`, `Info`, `Date/Time/DateTimePicker`, `ImageUpload`
generically, but no match-profile question is known to use them.

---

## Open questions for Sahil

1. **Store sync:** Does the backend sync gender across stores (survey `gender` → `rating_gender`,
   or account `gender` → `rating_gender`), or are they set independently and free to diverge?
2. **Seed provenance:** Does account `usta_rating` (set at league join) feed `self_rated_seed` /
   `starting_rating`? What does `self_rating_source` record?
3. **Live survey list:** What is the actual current set of match-profile survey questions, and is
   there a stable `question_code` per question the FE could key on instead of fuzzy text matching?
