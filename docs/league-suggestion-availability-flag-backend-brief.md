# Backend brief — expose match availability on league suggestions (show "Full", don't hide)

**Owner:** Sahil (backend) · **Reporter:** frontend · **Type:** small enhancement (one field) that also fixes a stale-data bug

---

## Goal

We want the "players looking for matches" surfaces (League Detail card, Match Browser, Post-Availability review) to **keep showing matches that are already filled**, marked with a **"Full"** badge, instead of hiding them. Showing filled matches is useful **social proof** — it signals the league is active and people are posting — while making clear which ones can still be joined.

To do that the frontend needs to know, per suggestion/open-need, **whether the underlying match is still open**. Today it can't.

## Current behavior / the problem

`GET /leagues/:id/match-needs` returns `suggestions` from **`listLeagueNeedSuggestions`** (the stored `match_suggestions` table). Each suggestion object has:

```
id, match_id, suggested_match_id, player_id, suggested_player_id,
player_name, player_skill, match_date, match_time, timezone,
match_location, time_variance_minutes, distance_miles, has_played_before, scored_at
```

**There is no `status` / availability field.** Two consequences:

1. **Stale filled matches leak through.** `match_suggestions` rows are **not purged when their `suggested_match_id` becomes non-open** (confirmed/cancelled). So a confirmed match keeps being suggested. Meanwhile the *live* matcher `canSuggestMatch` (`src/services/league_match_needs.js`) — used at POST time — correctly excludes `status !== "open"`. So the two paths disagree: the browser shows a filled match, but posting availability won't.
2. **Joining a filled one 409s.** `POST /leagues/:id/match-needs/preview/accept` returns `409 suggested_match_unavailable` when the target match's `status !== "open"`. The frontend now handles that gracefully, but it's a dead-end the user only discovers on click.

### Concrete repro (live prod data, league 3 "Men's 4.0 Spring")

- User **Paul Cochrane** (user 6) posted a need: **Jul 7, 2:00 PM PDT, Penmar Rec Center**.
- `GET /leagues/3/match-needs` returns suggestion **Peter Bergren → `suggested_match_id: 94`**, `distance_miles: 3.80`, `match_time: 15:00`.
- But match **94 is `confirmed`** (Tony Croutch already took it). It should read as **Full**, not joinable — yet it comes back as a normal suggestion with no way to tell.
- (For reference, it's a legitimate match otherwise: same date, singles, same league, 60-min gap ≤ 240-min window, 3.8 mi ≤ 5-mi window — it *would* match if open.)

## Ask (small)

**Do not purge — flag.** On each object returned by `listLeagueNeedSuggestions` (and the `scope=all` `needs` list), include the availability of the underlying match. Either is fine; `is_available` is simplest for the client:

```json
{
  "player_name": "Peter Bergren",
  "suggested_match_id": 94,
  "match_date": "2026-07-07",
  "match_time": "15:00",
  "distance_miles": 3.80,
  "status": "confirmed",       // the matches.status of suggested_match_id
  "is_available": false        // === (status === "open")
}
```

Implementation: the suggestion already carries `suggested_match_id`; join to `matches` (or `league_matches`) and surface that row's **`status`** (and/or a derived `is_available = status === "open"`). Apply the same to the `scope=all` open-need objects for consistency.

Please keep confirmed/cancelled rows **in** the response (that's the point — we want to display them), just correctly flagged. If there's a concern about unbounded growth of stale rows, a reasonable bound is "still shows for N days after confirmation," but not required for v1.

## Acceptance criteria

- Every suggestion / open-need in `GET /leagues/:id/match-needs` (default and `scope=all`) includes `status` (and/or `is_available`).
- A confirmed match (e.g. #94) is **still returned**, with `is_available: false` / `status: "confirmed"`.
- An open match returns `is_available: true` / `status: "open"`.
- Value is consistent with what `POST …/preview/accept` would do (open → 200 join; non-open → 409).

## Frontend follow-up (context)

Once the flag lands, the client change is small and is written to **fail open** (renders normally if the field is absent, so it's safe to ship before the backend):
- Render the card as today (name, TRP, time, distance).
- When `is_available === false`: show a **"Full"** badge and **disable "Join"**.
- Open ones stay joinable; no more 409-on-join.

## Related
Supersedes the earlier "purge confirmed suggestions" suggestion in the Match-Browser PR — flagging is better UX than hiding. Same DST/timezone-adjacent area but unrelated to those bugs.
