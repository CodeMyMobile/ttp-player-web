# Backend brief — coach booking timezone (cross-timezone bookings store the wrong time)

**Owner:** Sahil (backend) · **Reporter:** frontend · **Severity:** high (wrong lesson times + wrong notifications for any booking made outside the coach's timezone)

---

## Symptom

- A coach has availability at **1:00 PM Pacific**.
- A player physically **in New York (Eastern)** books that slot.
- The confirmation **notification says 5:00 PM**.

Expected: the lesson is at the coach's **1:00 PM Pacific** (= 4:00 PM Eastern for the NY player), and every notification reflects that single real instant.

## What's actually happening

`1:00 PM` is being interpreted in the **booking device's timezone (Eastern)** instead of the **coach's timezone (Pacific)**:

- `1:00 PM Eastern` = **17:00 UTC**  ← what gets stored
- `1:00 PM Pacific` = **20:00 UTC**  ← the correct instant

The notification renders the stored `17:00 UTC` as **"5:00 PM"**. So the booking is off by the offset between the player's zone and the coach's zone (3 hours here), and the displayed time is off on top of that.

This reproduces for **any** booking where the player's device timezone differs from the coach's — it is not specific to NY/Pacific.

## Root cause (two parts)

### 1. The availability payload does not include the coach's timezone
The coach schedule/availability response the app renders has **no timezone field** anywhere (no `timezone`, `utc_offset`, or per-slot absolute UTC). Slot times arrive as **naive local strings** (e.g. `"2026-07-15T13:00:00"` with no offset/`Z`). With nothing anchoring "1 PM" to *Pacific*, the client cannot convert it correctly.

### 2. The client then anchors to the device zone (frontend bug we will fix)
In `src/pages/CoachProfilePage.tsx` the booking builds the payload as:
```js
startDateTime:   moment(selectedSlot.start).utc().toISOString(),   // parses in the DEVICE zone
startDateTimeTz: moment(selectedSlot.start).toISOString(),         // also returns UTC → no offset info
```
- `moment(selectedSlot.start)` with no explicit zone uses the **booking device's** timezone.
- `start_date_time_tz` is produced with `.toISOString()`, which returns **UTC** — so it carries **no coach offset** the backend could use to correct the value. The `..._tz` fields are effectively duplicates of `start_date_time`.

We (frontend) will fix part 2, but we **cannot** without part 1: the API must tell us the coach's timezone (or give us absolute instants).

## What we need from the backend

### A. Put the coach's timezone in the availability / schedule payload (required)
On whatever endpoint feeds coach availability/booking slots, include the coach's IANA timezone, e.g.:
```json
{
  "coach_id": 800,
  "timezone": "America/Los_Angeles",
  "slots": [
    { "start_date_time": "2026-07-15T20:00:00.000Z", "end_date_time": "2026-07-15T21:00:00.000Z" }
  ]
}
```
**Strongly preferred:** emit each slot as an **absolute UTC instant** (`...Z`) computed from the coach's zone **with correct DST** (America/Los_Angeles = UTC-7 in summer, UTC-8 in winter — do not hard-code -8). If slots stay as local wall-clock strings, then a top-level `timezone` is mandatory so the client can convert with `moment.tz(local, timezone)`.

### B. Store the booking as the coach-anchored UTC instant (required)
`POST /player/lesson/:id/book` currently receives `start_date_time` / `start_date_time_tz` that depend on the *player's* device. The stored lesson start must be the single UTC instant of the coach's slot, **independent of where the player books from**. Please confirm the server derives/validates the stored time from the coach's timezone (or the slot's absolute UTC), not from a client-local string. Ideally accept `start_date_time` as absolute UTC and ignore device-derived `_tz` fields.

### C. Format notifications in an explicit, correct zone (required)
The confirmation/reminder notifications should not print a bare UTC/ambiguous time. Show an explicit zone — ideally **both**:

> Lesson confirmed: **Tue Jul 15, 1:00 PM PDT** (4:00 PM your time)

At minimum, label the zone (`1:00 PM PDT`) so "5 PM" (raw UTC) never appears. Same DST caveat as (A): use the real America/Los_Angeles offset for the date, not a fixed -8.

## Acceptance criteria

- A coach's 1:00 PM Pacific slot booked from **any** player timezone stores the **same** UTC instant (`20:00Z` in summer).
- The player's confirmation reads **1:00 PM PDT** (and/or 4:00 PM Eastern) — never 5:00 PM.
- Correct across the **DST boundary** (a Nov slot at 1 PM Pacific = `21:00Z`, not `20:00Z`).
- The availability payload exposes the coach's timezone (or per-slot absolute UTC) so the client can render and book correctly.

## Frontend follow-up (context)
Once (A) lands, we'll change `CoachProfilePage` to anchor the booking on the coach's timezone (`moment.tz(slot.localTime, coachTimezone).utc()`) instead of `moment(slot.start)`, and drop reliance on the device-derived `_tz` fields. We'll also surface the coach's zone in the UI so players see the correct local time before they book.

## Related
Same timezone/DST family as the flex-league match-need DST issue (times stored ~1h early because a fixed Pacific offset was used instead of the DST-aware offset). Worth auditing any shared date→UTC helper for the hard-coded-offset pattern.
