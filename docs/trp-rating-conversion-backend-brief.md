# Backend brief — TRP → NTRP/UTR equivalents (gender-aware, server-side)

**For:** Sahil / backend
**From:** Frontend (Paul)
**Status:** Request — not started

## Problem

We want to display, for a player, an **NTRP** and **UTR** value **derived from their TRP** (the Tennis Plan Rating we calculate on the backend). The conversion formula is **different for male vs female** players.

Two hard requirements up front:

1. **These are calculated, not self-reported.** The `usta_rating` / `uta_rating` we already store on the user profile are values the **player typed in themselves**. The new values are **computed from TRP**. They must be **separate fields** — do not overwrite or reuse `usta_rating` / `uta_rating`, or we conflate "what the player claims" with "what we calculated."

2. **The conversion should live on the backend**, exposed as fields the frontend just reads. Rationale below.

## Why backend, not frontend

The formula needs two inputs per player: **TRP** (`current_rating`) and **gender** (`rating_gender`). The backend already has **both** together (it computes TRP and stores `rating_gender` — the rankings feed and user object already carry `rating_gender` "M"/"F", and `PublicMatchResultsPage` already does gender-aware rating math with it).

The **frontend does not** have gender where it needs it:

- **League standings** (`GET /leagues/{id}/standings`) and **fixtures** carry **neither** gender **nor** any rating — so we can't convert there at all client-side.
- Per-player gender only appears on the **rankings feed** (`rating_gender`) and **player profiles** (`gender`), not on the league surfaces where we want to show the number.
- We *could* infer gender from `League.gender`, but that only works for **single-gender leagues** and breaks the moment we reuse the number anywhere else (mixed leagues, player cards, search, invites…). Not reusable.
- A client-side formula would also be a **second source of truth** that silently drifts if the mapping changes.

Doing it once on the backend gives a single, gender-correct source of truth that's reusable in every context without the FE hunting for gender.

## What we need

Compute, server-side, from a player's `current_rating` (TRP) using the **gender-specific formula** (backend owns the exact formula — see "Formula" below), and expose two new derived fields wherever a player's rating is returned:

| New field | Meaning |
|---|---|
| `calculated_ntrp` | NTRP equivalent of TRP (gender formula applied). Nullable. |
| `calculated_utr` | UTR equivalent of TRP (gender formula applied). Nullable. |

(Names are a suggestion — anything that's clearly *distinct from* `usta_rating`/`uta_rating` works, e.g. `trp_ntrp` / `trp_utr`.)

### Endpoints that should carry the new fields

Priority order for our use cases:

1. **`GET /leagues/{leagueId}/standings`** → each standings row. *(Currently returns no ratings and no gender — this is the main gap.)*
2. **`GET /leagues/{leagueId}/players`** → each player. *(Already returns `current_rating`, `usta_rating`, `uta_rating` — add the two calculated fields.)*
3. **`GET /match-results/rankings`** → each ranking. *(Already has `current_rating` + `rating_gender`.)*
4. **The authenticated user object** (login response / profile) → so the current user's own equivalents are available app-wide.
5. **`GET /leagues/{leagueId}/match-needs` → `suggestions[]`** (`LeagueMatchSuggestion`). The "Players looking for matches" card shows these, and we want to display each player's rating there. Today a suggestion only carries `player_skill` (a band, not TRP) — **no `current_rating`/TRP and no `rating_gender`**, so we can't show or convert a rating. Please add **`current_rating` (TRP)** and the derived **`calculated_ntrp`/`calculated_utr`** to each suggestion (matching what standings/players will carry).

## Formula

The gender-specific TRP→NTRP/UTR mapping is **owned by the backend** — please apply the agreed/official formula. We do **not** want to hardcode it on the frontend. (For reference, `PublicMatchResultsPage` already uses a gender base of `4.5` for `F` and `5.0` for `M`, so the concept and the `rating_gender` input already exist server-side.)

If the formula isn't finalized, that's the blocker to resolve first — let us know and we'll align on it.

## Edge cases / nullability

Please define behavior (and return `null` rather than a wrong number) when:

- **No TRP yet** (`current_rating` is null / player is provisional / 0 matches) → `calculated_ntrp` / `calculated_utr` = `null`.
- **Gender unknown** (`rating_gender` missing) → `null` (we'd rather show nothing than pick a formula arbitrarily).
- **Provisional / estimate** ratings — should the calculated values still be returned? Flag if they should be marked provisional too (we already surface an "estimate" badge).

## Frontend side (once shipped)

We'll read `calculated_ntrp` / `calculated_utr` directly on standings/players/rankings/user and render them — no client-side conversion, no gender lookups. Until then, if we need something sooner we may ship a **single-gender-league-only** stopgap (infer gender from `League.gender`, standings only), but that's a deliberate local exception, not the real fix.

## TL;DR

- Add **`calculated_ntrp`** + **`calculated_utr`** (TRP-derived, gender formula applied server-side) to **standings**, **players**, **rankings**, and the **user object**.
- Keep them **separate** from the self-reported `usta_rating` / `uta_rating`.
- Backend is the right home because it already has TRP + `rating_gender` together; the FE doesn't have gender on the league surfaces.
- Confirm the **gender-specific formula** and the **null** behavior for missing TRP/gender.
