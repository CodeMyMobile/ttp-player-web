# Backend brief: data for the player recommendation engine

**To:** Sahil
**From:** Paul
**Re:** API support for a player-facing recommendation engine on ttp-player-web

---

## Why (the engine we're building)

We want a recommendation engine that runs **on the player's home load** and surfaces things like:

- **Routine re-booking** — "book again" across the three activity types a player actually does: matches, 1:1 coach lessons, and group classes (e.g. a player who plays a Tuesday 7pm doubles match or a weekly Thursday clinic should get nudged to rebook the next one).
- **Social / level / location / time scoring** — rank suggestions by who they've played with before, similar skill level, nearby locations, and compatible times.

The raw data for most of this already exists in the API — but it's only reachable **per-activity, and every consumer re-fetches and aggregates it client-side.** That's fine for a detail page; it won't scale to something that has to run on every home load and score across a player's whole history. The asks below are mostly about **aggregation and a couple of genuine data gaps**, not net-new collection.

**Guiding principle:** only expose what's real. Don't synthesize fields we don't actually have — if a signal isn't tracked yet, leave it out and we'll defer that part of the engine.

---

## What already works (no action needed — context for what to build on)

- **Match history** is complete: created + joined, past + upcoming, including **participant identity** (name + id). Consumed via `GET /matches` (`src/api/matches.ts:1402`, `src/play-dates/services/matches.js:170`). Participants come back as `{id, name, identityIds, profileImageUrl, status, hosting}` (`src/api/matches.ts:12-23`).
- **1:1 coach lesson history**: `GET /player/past_lessons`, `GET /player/upcoming_lessons` (`src/api/playerHome.ts:117,141`), plus per-coach `GET /player/coach/lessons/history/{coachId}` (`src/api/player.ts:56`).
- **Upcoming group classes + roster**: `POST /player/upcoming_group_lessons` (`src/api/groupLessons.ts:359`), with attendees in `groupPlayers[]`.

The Schedule/My Schedule surface already proves the aggregation pattern — it fans out to four endpoints in parallel and merges them client-side (`src/screens/Player/PlayerCalendar/index.tsx:307-330`). The connections logic likewise is recomputed in the browser today (`src/play-dates/pages/PlayerConnectionsPage.jsx:421-541`). Those are the patterns we want to move server-side.

---

## The asks (in priority order)

### 1. Server-side player activity-history + connections **aggregation** endpoint  — highest value

**Problem:** Everything the engine needs to score against (matches, lessons, classes, and "who I've played with") already exists, but only as separate per-activity calls that the client fetches in full and aggregates in memory. The Schedule screen already does the 4-way fan-out (`PlayerCalendar/index.tsx:307-330`); `PlayerConnectionsPage.jsx:421-541` already rebuilds "players I've played with" client-side by pulling all of my matches and deduping participant lists. Re-doing all of that on every home load to feed recommendations won't scale.

**Ask:** A single endpoint (e.g. `GET /player/activity-summary` or similar) that returns, server-aggregated for the authenticated player:

- **Unified activity history** across matches, 1:1 lessons, and group classes — each item normalized with: `type` (match/lesson/group), `start_date_time`, `end_date_time`, `location` (id + name + lat/lng if available), `level`/`skill`, `coach` (for lessons/classes), and `recurrence` summary where applicable.
- **Connections / co-participants** — the set of players this player has played *with*, aggregated across all their matches (and group classes where roster is known), with `{player_id, name, shared_activity_count, last_played_at}`. This is exactly what `buildPlayerSummaries()` in `PlayerConnectionsPage.jsx:421-541` computes client-side today — we want it computed server-side.

Build on the same data already behind `GET /matches`, `GET /player/past_lessons`, `GET /player/upcoming_lessons`, and `POST /player/upcoming_group_lessons`. We don't need new *fields* here — we need it joined and aggregated server-side so the client makes one cheap call.

I'd lean toward a **single combined endpoint** to minimise round-trips on home load, but if it's cleaner your end to split history and connections into two endpoints, that's fine — your call on structure.

---

### 2. Past group-class history + roster

**Problem:** There's no real "past group classes" view. `GET /player/past_lessons` returns a generic `LessonSummary` that **does not distinguish group classes from 1:1 lessons and carries no roster** (`src/api/playerHome.ts:14-21,141`). So we can detect routine 1:1 lessons and routine matches, but not routine group classes — a core re-booking case.

**Ask:** Either (a) have `past_lessons` type each item (group vs 1:1) and include the group roster for group items, or (b) add `GET /player/past_group_lessons` mirroring the shape of `POST /player/upcoming_group_lessons` (`src/api/groupLessons.ts:359`) — class title, coach, date/time, location, level, price, and `groupPlayers[]`. Roster matters because group-class attendees feed the social/connections signal too.

---

### 3. Expose group-class recurrence to the client

**Problem:** The API already carries recurrence in the group-lesson metadata, but our normalization **drops it** — the `GroupLesson` client type doesn't surface it (`src/api/groupLessons.ts:7-53`). 1:1 lessons do expose `metadata.recurrence{frequency,count}`; group classes don't reach the client with it.

**Ask:** Include recurrence (`frequency`, `count`, and series id if one exists) in the group-lesson responses (`POST /player/upcoming_group_lessons` and, per ask #2, the past variant), consistent with how 1:1 lesson `metadata.recurrence` already comes through. Recurrence is the cleanest signal for "this is a routine the player rebooks." If the field is already in the payload and we're just not mapping it, confirm and we'll fix it client-side — no backend change needed.

---

### 4. Two-player history overlap

**Problem:** "Players you've both played with" / shared history between two *arbitrary* players is impossible today. The client-side aggregation only works for the **authenticated** user's own activity — you can't read another player's history, so there's no way to compute overlap between player A and player B.

**Ask:** An endpoint to compute overlap between the current player and a target player — e.g. `GET /player/{otherPlayerId}/shared-history` returning shared matches/classes and mutual co-participants (`{count, players[], last_played_at}`). This powers the social ranking ("you've both played with Maya and Chris"). Lower priority than 1–3 because the engine can ship a first version on the current player's own history alone, but this is the unlock for true social recommendations.

Note this serves **two features, not just the engine**: it also unblocks the "players you've both played with" section already built on the player profile, which has no real data source today. So the same capability pays off twice.

---

## Explicitly deferred (do NOT build now)

**Outcome data** — scores, win/loss records, attendance confirmation, ratings, feedback. None of this exists in the API today and **the engine does not need it for v1.** Re-booking + social/level/location/time scoring all work without it. We're flagging it only so it's on the radar as a *future* signal — please don't invest in it for this phase. (And per the honest-data principle: until outcomes are genuinely tracked, we won't fabricate or infer them.)

---

## Privacy / auth scope

Connections and overlap data (asks #1 and #4) is for **authenticated use only** — a player's own connections, or the overlap between the current player and someone they're already viewing. It is **not** public exposure of who-played-with-whom. Scope it like the existing player-profile data boundary.

## Summary table

| # | Ask | Type | Build on |
|---|---|---|---|
| 1 | Aggregated activity-history + connections endpoint | Aggregation (data exists) | `GET /matches`, `past_lessons`, `upcoming_lessons`, `upcoming_group_lessons`; mirrors `PlayerConnectionsPage.jsx:421-541` |
| 2 | Past group-class history + roster | Data gap | mirror `POST /player/upcoming_group_lessons` |
| 3 | Group-class recurrence exposed | Field exposure (likely already in payload) | `src/api/groupLessons.ts:7-53` |
| 4 | Two-player history overlap | New capability | match/class participant joins |
| — | Outcome data (scores/win-loss/attendance) | **Deferred** | n/a |
