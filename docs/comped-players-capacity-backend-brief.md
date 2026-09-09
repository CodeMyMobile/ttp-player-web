> **SUPERSEDED — the fix in this brief is wrong.** It recommends counting every
> non-cancelled row, which also counts unaccepted invitations. That shipped and made
> lesson 2756 read 11 of 7 and report itself full, blocking five sellable seats. See
> `group-lesson-capacity-correction-brief.md`. The 2669 diagnosis below still stands;
> only the predicate is wrong.

# Backend brief — comped players don't count against capacity

**Owner:** Sahil (backend) · **Reporter:** frontend · **Type:** overbooking, live
**Related:** `coach-lesson-booking-defects-backend-brief.md` (this supersedes its defect 4)

---

## Symptom

Group lesson **2669** (`player_limit = 8`) is full, and players are still able to book. One
received an SMS confirmation with no transaction against it.

## Cause

A comped player holds a seat that the capacity check cannot see. Every comp permanently creates
one phantom seat, so a class oversells by exactly the number of players who were comped.

`countBookings` (**`models/coach_lesson.js:866`**) counts a row only if it has *paid*:

```js
this.where("payment_status", statusConstant.incoming_status.CONFIRMED)
  .orWhere("payment_method", PAY_ON_COURT_METHOD);
```

A comped player is neither, and never will be — nobody is going to pay for them. The row is
created by the coach-side add at **`routes/coach_lesson.js:1258`** with no payment fields at all:

```js
const [participant] = await coachLesson.insertOrUpdateParticipant({
  lesson_id: lessonId,
  player_id: player_id,
  // stripe_paymentintent_id will be set once they pay via webhook
  stripe_paymentintent_id: null,
  metadata: { invited: true }
});
```

`payment_status` and `payment_method` are omitted, so the row lands at `0` / null and stays
there forever.

### Live state of 2669

```
player_limit                                   8
rows                                          10

counted by countBookings                       6   payment_status = 1
NOT counted — comped                           2   Ed Albala, Bea   (status 0, payment_status 0)
NOT counted — cancelled                        2   correctly ignored

capacity check evaluates:  6 >= 8  →  false  →  ALLOW
seats actually occupied:   8 of 8
```

Two comps, two extra bookings admitted. The arithmetic matches the report exactly.

### It compounds, and it also lets coaches overshoot

The coach-side add guards itself with the **same** counter
(`routes/coach_lesson.js:1243`, comment: `// optional: enforce player_limit`):

```js
const bookedCount = await coachLesson.countBookings(lessonId);
if (lesson.player_limit && bookedCount >= lesson.player_limit) { … }
```

So each comp lowers the count that gates the next comp. Comping is self-permitting.

### Why the SMS arrived with no transaction

The participant row is inserted first and the confirmation is sent on insert, before any charge
settles. For a comped player that is correct — there is no charge — but it means an unpaid seat
and a real confirmation are indistinguishable from a successful purchase downstream.

---

## Fix

**Count reserved seats, not settled payments.** A seat is occupied whether it was paid for,
comped, or is pending:

```js
.whereNot("payment_status", statusConstant.incoming_status.CANCELLED)
```

That single clause replaces both existing conditions. `payment_method = PAY_ON_COURT` becomes
redundant — those rows are already not-cancelled.

Against 2669 this yields **8 of 8**, and the class closes.

`countBookings` has **11 call sites**, more than any other function involved in these reports, so
this is the widest-reaching change in the file and deserves the most review.

---

## The thing to fix at source: a comp is not distinguishable from an abandoned checkout

Both are `payment_status = 0` with a null `stripe_paymentintent_id`. Nothing in the schema says
which is which.

That matters as soon as anyone adds a timeout to release stale unpaid seats — the obvious next
step once pending rows count — because it would silently cancel players a coach deliberately
comped. The timeout and the comp are on a collision course.

The only current signal is `metadata: { invited: true }`, set on the coach path and absent on the
player path. It works today, but it is untyped JSON that none of the capacity, payment or
reporting logic reads.

**Suggested:** mark comps explicitly, matching the pattern already used elsewhere in this
codebase — `src/services/restringingOrders.js:499` uses `payment_method: "comp"` for exactly
this idea:

```js
payment_method: "comp"
```

Then a comp counts toward capacity, a timeout can exclude it, and revenue reporting can tell a
comped seat from a sold one.

**One schema caveat before writing that:** `payment_method` is **not** an original column on
`lesson_participants`. The table was created with `id, lesson_id, player_id,
stripe_paymentintent_id, payment_status, metadata, created_at, updated_at`
(`20250206184929_add_lesson_participants_table.js`); `payment_method` arrives later via
`20260715120000_add_pay_on_court_fields.js`. It exists, but it was added for pay-on-court, so
worth confirming its intended domain before overloading it with `"comp"`.

---

## What we can and cannot verify from the frontend

The counts above come from the `group_players` payload on
`POST /player/upcoming_group_lessons`, so we can confirm 2669 reads 8 of 8 once this ships.

We cannot see which row belongs to whom beyond display name — and the reported player, **Julio
Bajdaun, does not appear in the participant list for 2669 at all**. The two uncounted seats show
as "Ed  Albala" (note the double space) and "Bea". So either the display names are stale, or
Julio's booking did not create a row while still sending him an SMS — which would be a separate
and worse defect than this one.

This settles it:

```sql
SELECT lp.id, lp.lesson_id, lp.player_id, lp.status, lp.payment_status,
       lp.payment_method, lp.stripe_paymentintent_id, lp.metadata, lp.created_at,
       pp.full_name
FROM lesson_participants lp
JOIN player_profile pp ON pp.user_id = lp.player_id
WHERE lp.lesson_id = 2669
ORDER BY lp.created_at;
```

If Julio has no row, the SMS fired without a committed participant and that needs its own ticket.

## Immediate cleanup

2669 is two over capacity. Before anyone cancels rows: confirm whether Ed Albala and Bea are
deliberate comps — we believe they are — because they have each had a confirmation SMS, and a
cancellation would be the second wrong message they receive. If they are comps, the lesson is
correctly full at 8 and the roster is right; only the counter is wrong.

## Correction to the earlier brief

`coach-lesson-booking-defects-backend-brief.md` describes this as defect 4 and frames it as
"pending unpaid rows are invisible", with a note asking whether abandoned checkouts should time
out. That framing was incomplete: the uncounted rows on this roster are **deliberate comps**, not
abandonment. The fix is the same one clause; the reasoning and the follow-on work are different,
and the timeout idea in that brief should not be built without the comp marker above.
