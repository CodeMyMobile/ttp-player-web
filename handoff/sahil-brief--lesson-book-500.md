# Handoff to Sahil — 500 on `POST /player/lesson/2037/book` (real-payment booking)

**Context:** First real-payment test on prod failed. Two things showed in the browser console; this brief separates them and hands over **exactly what the client sent** so you can pair it with the **500 you're returning** (cause is server-side, in your logs).

**Status from the frontend side:** the client request is well-formed and unchanged by recent frontend work (proof below). The 500 is the backend throwing on the booking call.

> ⚠️ **No more real-payment attempts on prod until you confirm this endpoint works.** Every retry is a real charge against a currently-broken endpoint. This is the first time this payment path has been exercised end-to-end on prod.

---

## 1. The `wallet-config` 401s — red herring (Stripe's own, not ours)

The console also showed repeated `merchant-ui-api.stripe.com/.../wallet-config` **401s**. These are **not our API**:

- `merchant-ui-api.stripe.com` is a **Stripe.js internal endpoint**. Grep of our entire codebase for `merchant-ui-api` / `wallet-config` returns **nothing** — we never call it.
- It's fired by the Stripe SDK probing **Apple Pay / Google Pay (wallet / Payment Request) availability & domain registration**. A 401 there means the wallet/domain isn't registered — it only suppresses the Apple/Google Pay button.
- **Non-fatal to a card charge.** A saved-card charge sends a `payment_method_id` to *our* booking endpoint and does not depend on wallet-config. Proof it didn't block this attempt: our backend **received** the booking call and returned a 500 — so the request got through.

**Action:** ignore for this bug. (Worth registering the domain later for Apple/Google Pay, but unrelated.)

---

## 2. The real failure — what the client sends to `/lesson/:id/book`

**Request line** (`{lessonId}` is a path param):

```
POST https://api.thetennisplan.com/api/player/lesson/2037/book
```

**Headers** (from `src/api/http.ts`):

```
Accept: application/json
Content-Type: application/json
Authorization: token <JWT>          # see auth-scheme note below
```

### Payload for lesson 2037 → **Shape A** (full occurrence body)

Determined by code trace (see §4). Built by `joinLesson` (`src/api/playerLessons.ts:213`):

```json
{
  "location_id": 123,                                  // numeric venue id
  "coach_id": 45,                                       // numeric coach id
  "start_date_time": "2026-07-01T17:00:00.000Z",        // UTC ISO
  "end_date_time":   "2026-07-01T18:00:00.000Z",        // UTC ISO
  "start_date_time_tz": "2026-07-01T10:00:00-07:00",    // local-offset ISO
  "end_date_time_tz":   "2026-07-01T11:00:00-07:00",    // local-offset ISO
  "status": "CONFIRMED",
  "court": 0,
  "payment_method_id": "pm_xxx"                          // Stripe PaymentMethod
}
```

> The actual field values for 2037 are in **your** request log (the 500's request body). Use this as the schema map.

### The other shape (for reference) — **Shape B** (minimal)

If the loaded group lesson had **no** occurrence times, the client would instead call `bookGroupLessonWithCard` (`playerLessons.ts:242`) with **only**:

```json
{ "payment_method_id": "pm_xxx" }
```

For 2037 this is **not** the expected shape (see §4), but flagged so you can recognize it if you see it.

---

## 3. ⭐ Key finding — no amount is sent; backend charges off `lesson_id` alone

**Neither booking function sends `amount`, `price`, `currency`, or any monetary field.** The only payment data on the wire is `payment_method_id`.

➡️ **The backend must look up lesson 2037's price server-side and create/confirm the Stripe charge itself.** There is no client-supplied amount and no separate client-side quote call in this flow.

**This is the most likely 500 surface.** Since the client just hands you a `payment_method_id` + lesson id, the server-side **price lookup** and/or **Stripe charge/PaymentIntent confirm** step is where to look first. A 500 on the very first real charge most likely means this server-side capture path was never confirmed working — not a malformed client request.

**Scoping fact:** `/lesson/:id/book` with a payment is **group-lesson-only**. Private-lesson card bookings never hit this endpoint (they go via `requestPrivateLesson` / `createPlayerStripePaymentIntent`). So **lesson 2037 is a group lesson**, charged via `payment_method_id` with the server deriving the amount.

**Auth-scheme note (minor):** `joinLesson` sends `Authorization: token <JWT>` (lowercase). `bookGroupLessonWithCard` sends `Token <JWT>` (capital T). Same endpoint, different scheme casing. If your auth middleware is case-sensitive on the scheme, worth a glance — but this would 401/403, not 500, so it's likely not the cause here.

---

## 4. Shape A vs B determination for 2037

The paid group flow (`BookingConfirmationPage.bookOpenGroupLessonWithPayment`) picks the shape by:

```js
shouldBookOccurrence = Boolean(groupLesson && groupLesson.startDateTime && groupLesson.endDateTime)
// true  -> joinLesson(... full body ...)         // Shape A
// false -> bookGroupLessonWithCard({ pm })        // Shape B
```

`groupLesson` is loaded via `fetchUpcomingGroupLessonById` → `mapUpcomingGroupLesson`, which sets
`startDateTime = lesson.start_date_time` and `endDateTime = lesson.end_date_time`
(`src/api/groupLessons.ts:342-343`). A scheduled group lesson returns these times, so `shouldBookOccurrence` is **true → Shape A**.

**Confidence:** code-trace inference, not a captured runtime body. Definitive confirmation = the request body in your 500 log. If it shows all the `*_date_time` fields → Shape A (expected). If it's only `{ payment_method_id }` → Shape B (means the group lesson loaded without occurrence times — a separate frontend question to raise back).

---

## 5. Frontend changes are cleared (PR 5/6/7 + image fix did not touch this)

Byte-for-byte verification that recent frontend work did not alter the booking request:

- **Booking API module `src/api/playerLessons.ts`** (endpoint, payload, headers): **0 commits** in `fe06e4a..HEAD` (the range covering PR 5/6/7 + the image fix). Untouched.
- **Call sites** `BookingConfirmationPage.tsx` and `PlayerLessonDetailsPage.tsx`: **0 commits** in range. `CoachProfilePage.tsx` had 2 commits, but `git log -p` over the range shows **no** added/removed line touching any payload field (`joinLesson`, `bookGroupLessonWithCard`, `location_id`, `payment_method_id`, `start_date_time`, `coach_id`, …).
- **PR 7 venue normalizer (`normalizeVenueLabel`)**: called in exactly 3 places, all producing **display labels** (`venueLabel`, `heroLocationLabel`, `"Court TBD"`). **Never** assigned to `location_id`/`locationId`. The payload's `location_id` always comes from a numeric id (`lesson.location_id`, `slot.location_id`, typed `number | null`); line `BookingConfirmationPage.tsx:859` shows the separation — `.find(item => item.id === locationId)?.label` (id is the key, label is the normalized display). The normalizer cannot reach the booking payload.

**Conclusion:** the client request shape is identical to before the recent frontend work. The 500 is on the server-side book-with-payment path (price lookup / Stripe charge), being exercised for the first time on prod.

---

## TL;DR

- Client sent: `POST /player/lesson/2037/book` with `payment_method_id` + (Shape A) occurrence/location/coach fields. **No amount.**
- Backend charges off `lesson_id` → look at server-side **price lookup + Stripe charge** as the 500 source.
- Confirm exact body from your 500 request log (Shape A expected).
- Recent frontend changes are proven not to touch this path.
- 🚫 No more real-payment retries until the endpoint is confirmed working.
