# Open items — backend and deploy

**Owner:** Sahil (backend), plus one frontend deploy · **Reporter:** frontend
**Verified against production on 8 Sep 2026.** Every number below was measured, not inferred.

Two items are actively costing bookings today (1 and 3). One needs a deploy and no code
change (2). One is a correction to advice this side gave earlier, and should be read before
touching capacity code again (1).

| # | Item | Impact | Where |
|---|---|---|---|
| 1 | Capacity counts pending invites | **Blocking sales now** | `models/coach_lesson.js:866` |
| 2 | Stale frontend bundle on the group lesson page | **Anonymous users told they're booked** | deploy only |
| 3 | Back-to-back lesson slots rejected | **Blocking bookings now** | `models/coach_lesson.js:240` |
| 4 | Payment-failure emails carry no date or reason | Player can't act on it | `routes/coach_profile.js:384` |
| 5 | Coach fields missing from `/public/coaches` | Blocks public profile content | `routes/public_coaches.js` |
| 6 | Booking deep links are inert | Lost intent and attribution | app routing |

---

## 1. Capacity counts pending invitations as booked seats

**Group lesson 2756 reads "11 of 7 players booked" and reports itself full. Two players hold
a seat. Nine are invitations nobody accepted. Five sellable seats cannot be sold.**

Reproducible without auth:

```bash
curl -s https://api.thetennisplan.com/api/public/lessons/2756 \
  | python3 -c "import json,sys; l=json.load(sys.stdin)['lesson']; \
print(l['booked_count'], l['player_limit'], l['open_spots'], l['is_full'])"
# 11 7 0 True
```

| | 2756 | 2669 |
|---|---|---|
| `player_limit` | 7 | 12 |
| `booked_count` | **11** | **11** |
| `open_spots` / `is_full` | 0 / **true** | 1 / false |
| paid (`payment_status = 1`) | 1 | 6 |
| comped (`payment_method = 'comped'`) | 1 | 3 |
| pending, no method | **9** | 2 |
| **seats actually held** | **2** | **9** |

`booked_count` equals the total non-cancelled participant rows in both lessons.

### This is a correction to our earlier brief

`comped-players-capacity-backend-brief.md` recommended exactly the predicate now running:

```js
.whereNot("payment_status", statusConstant.incoming_status.CANCELLED)
// "That single clause replaces both existing conditions."
```

The reasoning was "a seat is occupied whether it was paid for, comped, or is pending." That
holds for a comp and is defensible for a checkout in progress. It is **false for an invitation
the player never accepted**, and 2756 is mostly invitations. That brief also noted that a comp
and an abandoned checkout are indistinguishable, then failed to carry the caveat into the
recommendation. Undercounting became overcounting.

**What has changed since:** comps now carry `payment_method = 'comped'` — 3 rows on 2669, 1 on
2756 — so the count no longer has to guess.

### Fix

Count a row when it actually holds a seat: paid, pay-on-court, or comped.

```js
const countBookings = async (lesson_id, connection = db) => {
  const result = await connection("lesson_participants")
    .where({ lesson_id })
    .whereNot("payment_status", statusConstant.incoming_status.CANCELLED)
    .whereNot("status", statusConstant.incoming_status.CANCELLED)
    .andWhere(function () {
      this.where("payment_status", statusConstant.incoming_status.CONFIRMED)
        .orWhere("payment_method", PAY_ON_COURT_METHOD)
        .orWhere("payment_method", "comped");
    })
    .count("id as total");

  return result[0].total;
};
```

Against production data:

```
2756:  1 paid + 1 comped  =  2 of 7   (5 seats released)
2669:  6 paid + 3 comped  =  9 of 12  (3 open, comps still counted)
```

The original 2669 report — comps not holding seats — stays fixed.

**Before editing, confirm what is deployed.** The `countBookings` committed in the repo would
return 1 for 2756, not 11. Production is running something else.

`countBookings` has ~11 call sites, more than anything else in these reports, so this is the
widest-reaching change here.

### It already matches the frontend

`holdsGroupSpot` (`src/api/groupLessons.ts:282`) encodes this rule today: cancelled never
counts, comped always counts, otherwise the row needs `status === 1` and either
`payment_status === 1` or pay-on-court. Run over the live payloads it yields **2** and **9**.
The SQL above is that rule, so the two stop disagreeing.

### Verify after deploy

```bash
curl -s https://api.thetennisplan.com/api/public/lessons/2756 \
  | python3 -c "import json,sys; l=json.load(sys.stdin)['lesson']; \
print(l['booked_count'], l['open_spots'], l['is_full'])"
# expect: 2 5 False
```

---

## 2. The group lesson page is running a stale bundle — deploy only

**Every visitor to lesson 2756 is told "✓ You're booked — Your spot is confirmed for this
class." and shown a Cancel booking button, whether or not they have booked.**

This is *not* the capacity bug. Same lesson, same production API, both logged out with empty
`localStorage`:

| | local `main` | production |
|---|---|---|
| "You're booked" banner | absent | **shown** |
| "Cancel booking" button | absent | **shown** |
| avatars in "Who's joining" | 2 | 6 shown, **+6 → 11** |
| count | 11 of 7 | 11 of 7 |

The count matches because it comes from the API. Everything else differs, so current frontend
code already renders this correctly for an anonymous visitor.

On `main`, `isBooked` reads `holdsGroupSpot(...)` over the *matched* participant row
(`GroupLessonDetailsPage.tsx:893`). With no match every argument is `undefined`,
`parseStatusValue` returns `null`, and it is false. The roster renders through
`buildVisibleGroupLessonParticipantRows` rather than raw `groupPlayers`, which is why local
shows 2 and production 11.

**Action: redeploy the frontend.** No code change.

**Check urgently:** production offers an anonymous visitor a *Cancel booking* button. We did
not click it — it acts on live bookings. Confirm the endpoint rejects an unauthenticated
caller and cannot target another player's participant row. If it can, that outranks everything
else on this page.

### Both fixes are needed, and neither substitutes for the other

After a frontend deploy alone, 2756 still reads "11 of 7" and still pushes players to the
waitlist, because `booked_count` and `is_full` come from the API. Local `main` against
production today shows exactly that: no false banner, but "11 of 7" and a *Join waitlist* CTA
where there are five open seats.

---

## 3. Back-to-back bookings are rejected as overlapping

`isLessonSlotAvailable` (**`models/coach_lesson.js:240`**)

```js
this.whereBetween("start_date_time_tz", [startDateTimeTz, endDateTimeTz])
  .orWhereBetween("end_date_time_tz", [startDateTimeTz, endDateTimeTz])
  .orWhere(function () {
    this.where("start_date_time_tz", "<", startDateTimeTz)
      .andWhere("end_date_time_tz", ">", endDateTimeTz);
  });
```

`whereBetween` is inclusive, so a lesson that **ends** exactly when the next slot **starts**
counts as an overlap:

```
existing   08:00 – 09:00
new slot   09:00 – 10:00
end_date_time_tz BETWEEN '09:00' AND '10:00'  →  TRUE  →  400
```

**Every booking makes the following hour unbookable.** Reproduced by hand on coach 26:

| state | attempt | result |
|---|---|---|
| 8am booking exists | book 9am | blocked |
| then created a 9am booking | book 10am | blocked |
| nothing ends at 11:00 | book 11am | **succeeds** |

The player is offered the slot and gets a 400 on submit — `"coach not available in this time
slot"` (`Validators/player_lessons.js:132`).

### Fix

Half-open intervals `[start, end)`. One predicate replaces all three branches and is correct
for every arrangement:

```js
this.where("start_date_time_tz", "<", endDateTimeTz)
    .andWhere("end_date_time_tz", ">", startDateTimeTz);
```

The `coach_calendar_events` block below it in the same function needs the identical change.

### Two latent siblings, same pass

- **`findLessonsOverlappingRange` (`:264`)** has the same inclusive construction. It feeds
  availability generation, so where the above rejects a valid booking, this one *hides a valid
  slot*. Fix with the same predicate or the two keep disagreeing about "overlapping".
- **`isLessonSlotAvailable` has no status filter**, so a cancelled lesson blocks its slot
  forever. `findLessonsOverlappingRange` directly beneath it *does* filter cancelled, and the
  read path filters it in three more places. The write path is the odd one out.

  *Note:* this was our first diagnosis of the 10am report and it was **wrong** — the inclusive
  boundary is what blocks that slot. Real defect, but latent; fixing it alone verifies nothing.

---

## 4. Payment-failure emails carry no date and no reason

`routes/coach_profile.js:384` renders `client/paymentIntentFailed.ejs` with:

```js
{ date: new Date(failedLesson.start_date_time).toDateString(),
  message: error.raw.message }
```

**The template contains zero EJS tags.** Verified:

```bash
python3 -c "import re;s=open('client/paymentIntentFailed.ejs').read();\
print(len(re.findall(r'<%[-=]?.*?%>',s,re.S)), 'date' in s.lower(), 'message' in s.lower())"
# 0 False False
```

143 lines, no `<% %>`, and the words "date" and "message" appear nowhere. Both values are
silently discarded, so the player gets a generic "Payment Failed" email with no lesson date
and no reason — nothing they can act on.

### Second defect in the same path: a module-scope variable

```js
let failedLesson;              // line 52, module scope
...
failedLesson = lesson[0];      // line 314
...
const user = await userDB.findById(failedLesson.player_id);   // line 384
```

`failedLesson` is shared mutable state across every concurrent request in the process. Two
overlapping webhooks race: the second assignment lands before the first reads it, and the
email goes to the wrong player about the wrong lesson. Rare under light load, and silent when
it happens — the wrong person is simply told their payment failed.

Make it a local bound to the request.

---

## 5. Coach fields are missing from `/public/coaches`

The public coach pages can render specialties, formats, experience and student counts. The
endpoint they read does not carry them, though the data exists on the search endpoint.

`GET /api/public/coaches` — 45 coaches, 10 keys:

```
bio, certifications, courts, focus_areas, name, photo_url,
rate_group, rate_private, slug, student_count
```

| field | on `/public/coaches` | on `/public/coaches/search` |
|---|---|---|
| `formats` | **absent** | 31/31 |
| `student_count` | empty on 45/45 | 26/31 |
| `specialties` | absent (`focus_areas`, empty on 45/45) | 16/31 |
| `levels` | **absent** | 16/31 |
| `experience_years` | **absent** | 16/31 |
| `languages` | **absent** | 16/31 |
| `certifications` | empty on 45/45 | 3/31 |

Note the naming mismatch: the populated field is `specialties` on search; `/public/coaches`
exposes `focus_areas`, which is empty for every coach.

**Ask:** map these onto `/public/coaches` with the same names as search. The public cards and
profiles already render each one conditionally, so they light up with no frontend change.

Reproduce:

```bash
curl -s https://api.thetennisplan.com/api/public/coaches | python3 -c "import json,sys;\
c=json.load(sys.stdin);print(len(c), sorted(c[0]))"

curl -s -X POST 'https://api.thetennisplan.com/api/public/coaches/search?perPage=50&page=1' \
  -H 'Content-Type: application/json' \
  -d '{"position":{"latitude":33.985,"longitude":-118.4695}}' \
  | python3 -c "import json,sys; c=json.load(sys.stdin)['coaches'];\
print(len(c), sorted(c[0]))"
```

`certifications` is thin on both (3/31) — that one is a roster data-entry problem, not an API
one.

---

## 6. Booking deep links are inert

Public coach cards link to:

```
https://app.thetennisplan.com/#/?redirect=coach/<slug>&action=book
```

**Nothing in the app reads `redirect` or `action`** — grepped across `src/`, no matches outside
an unrelated Google Calendar test. An anonymous visitor clicking "Book a lesson" lands on the
app's landing page with no memory of which coach they wanted, so the intent is lost and the
per-coach attribution the links were meant to provide never materialises.

Lowest priority of the six, and the fix touches routing and `LoginPage`, so it needs a
decision before anyone starts.

---

## Suggested order

1. **Item 2's auth check** — an anonymous *Cancel booking* button, if it works, is the worst
   thing on this list. Minutes to confirm.
2. **Item 1** — five seats unsellable on one class today, and the count gates the write path.
3. **Item 3** — every booking blocks the next hour.
4. **Item 2's deploy** — no code change.
5. **Item 4**, then **5**, then **6**.

## What we can verify from here

Items 1, 2, 4 and 5 are checkable from the frontend and we can confirm each after deploy —
the commands are above. Item 3 we reproduced by hand on coach 26 and can re-test. Item 6 is
a code read.
