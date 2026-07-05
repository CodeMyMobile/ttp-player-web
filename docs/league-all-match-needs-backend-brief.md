# Backend brief — endpoint to list ALL active match requests in a league

**For:** Sahil / backend
**From:** Frontend (Paul)
**Status:** Request — not started

## What we're building

A **"Players looking for matches"** card on the League Detail page. It should show **every active match request (match-need) in the league** — not just the ones that happen to match my own availability — and let the frontend **prioritize** the ones that overlap my time/location.

## The gap

The only endpoint we have today is:

```
GET /leagues/{leagueId}/match-needs   →   { league, myNeeds, suggestions }
```

- `myNeeds` = the current user's own posted needs.
- `suggestions` = **only close matches** to my availability (personalized).

In testing, a league with many open needs returned **`suggestions.length === 1`** — just the single close match. So this endpoint can't power a "see everyone looking" view: the players who are looking at *other* times/places are never returned.

There is **no endpoint that returns all open match-needs posted by other players in a league.** That's what we need.

## What we need

A new endpoint (or a `scope` param on the existing one) that returns **all active/open match-needs in the league**, posted by other players.

**Preferred shape** — a `scope=all` mode on the existing endpoint:

```
GET /leagues/{leagueId}/match-needs?scope=all
→ { league, needs: LeagueMatchNeed[] }
```

or a dedicated endpoint if cleaner:

```
GET /leagues/{leagueId}/open-needs
→ { league, needs: LeagueMatchNeed[] }
```

### Each need should include

| Field | Notes |
|---|---|
| `id` | the match-need id |
| `player_id` | poster's id |
| `player_name` | display name |
| `player_skill` (TRP) | the poster's **TRP** (we show `TRP: X.XXX`). *(Also see the separate rating brief — ideally add `calculated_ntrp`/`calculated_utr` here too.)* |
| `start_date_time` | **full ISO-8601 UTC instant** (see timezone note) |
| `location` / `match_location` | text |
| `latitude` / `longitude` | for distance |
| `distance_miles` | distance from me (if you compute it) |
| `has_played_before` | have **I** already played this player? (lets us exclude/deprioritize) |
| `time_variance_minutes` | minutes between this need and my nearest availability, if computable (lets us flag "matches your time"). Optional — FE can also compute from my needs. |
| `status` | so we only show active/open ones |

This mirrors the existing `LeagueMatchSuggestion` shape, so ideally just reuse it.

### Behavior

- **Exclude the current user's own needs** (those are `myNeeds`).
- Return **active/open** needs only (not cancelled/expired/filled).
- **Sorting/prioritization** is done on the frontend (matches-first, then distance) — but returning `has_played_before` + `time_variance_minutes` is what lets us do it. If it's cheaper to sort server-side, that's fine too.
- Consider a reasonable **limit / pagination** if a league can have many open needs.

## Important — timezone (ties to a separate bug)

Please return the time as a **full UTC `start_date_time`** (ISO-8601 with `Z`), **not** a bare `match_time` string.

We found that the current `suggestions[].match_time` (e.g. `"22:00"`) is **inconsistent with the linked need's `start_date_time`** (e.g. `"2026-07-07T21:00:00.000Z"`) and carries no timezone, which produced a wrong display time. Separately, needs appear to be **stored ~1 hour early in summer** — i.e. `date + time + "America/Los_Angeles" → UTC` isn't applying **DST**. Please:

1. Return a single authoritative **`start_date_time` (UTC ISO)** per need.
2. Fix the **DST** handling when converting the posted `date + time + timezone` to UTC (and correct already-stored rows if feasible).

The frontend renders `start_date_time` in the viewer's local zone, so a correct UTC instant is all we need.

## TL;DR

- Add a way to fetch **all active match-needs in a league** (`?scope=all` or `/open-needs`) — the current `suggestions` only returns personalized close matches (we saw just 1).
- Each need: `id`, `player_id`, `player_name`, `player_skill` (TRP), **`start_date_time` (UTC ISO)**, location + lat/long, `distance_miles`, `has_played_before`, `time_variance_minutes`, `status`.
- Exclude the current user's own needs; active-only.
- Return a proper **UTC `start_date_time`** and fix the **DST** conversion on write (bare `match_time` is wrong/ambiguous).
