# Backend brief — pending invites are counted as booked seats

**Owner:** Sahil (backend) · **Reporter:** frontend · **Type:** capacity, live, blocking sales
**Supersedes the fix in** `comped-players-capacity-backend-brief.md`, **which was wrong.**

---

## Symptom

Group lesson **2756** shows **11 of 7 players booked** and reports itself full. Two players
actually hold a seat. Nine are pending invitations that were never accepted and never paid.

Because `open_spots` is 0 and `is_full` is true, **five sellable seats cannot be sold.**

## Live data, from the public endpoint

`GET https://api.thetennisplan.com/api/public/lessons/{id}` — no auth needed, reproducible now.

| | 2756 | 2669 |
|---|---|---|
| `player_limit` | 7 | 12 |
| `booked_count` | **11** | **11** |
| `open_spots` / `is_full` | 0 / **true** | 1 / false |
| rows: `payment_status = 1` (paid) | 1 | 6 |
| rows: `payment_method = 'comped'` | 1 | 3 |
| rows: pending, no method | 9 | 2 |
| **seats actually held** | **2** | **9** |
| over-count | **+9** | **+2** |

`booked_count` equals the total number of non-cancelled participant rows in both cases.

## Cause

`countBookings` (**`models/coach_lesson.js:866`**) is counting every row that is not cancelled,
so an unaccepted invitation occupies a seat.

The deployed behaviour and the committed source disagree — the source in this repo still has
the older, narrower predicate — so **confirm what is actually running before editing.** The
numbers above are from production.

## This is my error, and the correction matters

`comped-players-capacity-backend-brief.md` recommended exactly this:

```js
.whereNot("payment_status", statusConstant.incoming_status.CANCELLED)
// "That single clause replaces both existing conditions."
```

That reasoning was "a seat is occupied whether it was paid for, comped, or is pending." It is
true for a comp and defensible for a checkout in progress. It is **false for an invitation the
player has not accepted**, and lesson 2756 is mostly invitations.

That brief also flagged that a comp and an abandoned checkout are indistinguishable — both
`payment_status = 0` — and then failed to carry that caveat into the recommendation. Turning
undercounting into overcounting is not a fix.

**What changed since:** comps now carry `payment_method = 'comped'` (3 rows on 2669, 1 on
2756). The marker that brief asked for exists, so the count no longer has to guess.

## Fix

Count a row when it actually holds a seat — paid, pay-on-court, or comped:

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
2669:  6 paid + 3 comped  =  9 of 12  (3 seats open, comps still counted)
```

Both are correct, and the original 2669 report — comps not holding seats — stays fixed.

### It already matches the frontend

`holdsGroupSpot` (`src/api/groupLessons.ts:282`) encodes this rule today: cancelled never
counts, comped always counts, otherwise the row needs `status === 1` and either
`payment_status === 1` or pay-on-court. Run over the live payloads it yields **2** and **9**.
The predicate above is that rule in SQL, so the two stop disagreeing.

## Why we are not patching this on the frontend

The frontend could ignore `booked_count` and use its own filter, and it would display the
right number immediately. We are not proposing that: the booking write path gates on
`countBookings` through `insertGroupParticipantIfCapacity`, so 2756 would advertise five open
seats and then reject every attempt with a 400. That is the offered-but-unbookable state
already described in `coach-lesson-booking-defects-backend-brief.md`, and it is worse than
showing the class as full. The count has to be corrected where the write path reads it.

## Also worth separating at source

A pending invite and an abandoned checkout are still the same row shape. Only the coach path
sets `metadata: { invited: true }` (`routes/coach_lesson.js:1258`). Anyone adding a timeout to
release stale unpaid seats will need to tell them apart, and metadata is not something the
capacity, payment or reporting code reads. An explicit state on the row would settle it.

## Verify after deploy

```bash
curl -s https://api.thetennisplan.com/api/public/lessons/2756 \
  | python3 -c "import json,sys; l=json.load(sys.stdin)['lesson']; \
print(l['booked_count'], l['open_spots'], l['is_full'])"
# expect: 2 5 False
```

---

## Related but separate: the "You're booked" banner is a stale frontend deploy

Reported alongside this: every visitor to 2756 sees **"✓ You're booked — Your spot is
confirmed for this class."** and a **Cancel booking** button, whether or not they booked.

It is **not** caused by the count. It is a frontend build that predates fixes already on
`main`. Same lesson, same production API, both logged out with empty `localStorage`:

| | local `main` | production |
|---|---|---|
| "You're booked" banner | absent | **shown** |
| "Cancel booking" button | absent | **shown** |
| avatars in "Who's joining" | 2 | 6 shown, **+6 → 11** |
| count | 11 of 7 | 11 of 7 |

The count is identical because it comes from the API. Everything else differs, so current
frontend code already renders this lesson correctly for an anonymous visitor.

On `main`, `isBooked` reads `holdsGroupSpot(...)` over the current user's matched participant
row (`GroupLessonDetailsPage.tsx:893`), and with no match every argument is `undefined`,
`parseStatusValue` returns `null`, and it is false. The roster likewise renders through
`buildVisibleGroupLessonParticipantRows` rather than the raw `groupPlayers`, which is why it
shows 2 and not 11.

**Action: redeploy the frontend.** No code change needed for this half.

**Worth checking urgently:** production offers an anonymous visitor a *Cancel booking*
button. We did not click it — it acts on live bookings. Confirm the endpoint rejects an
unauthenticated caller, and that the button cannot target another player's participant row.

### The two fixes are independent, and both are needed

After a frontend deploy alone, 2756 still reads "11 of 7" and still pushes players to the
waitlist, because `booked_count` and `is_full` come from the API. Local `main` against
production today shows exactly that: no false banner, but "11 of 7" and a *Join waitlist*
CTA where there are really five open seats.
