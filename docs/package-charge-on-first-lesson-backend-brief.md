# Backend brief — charge lesson packages on first-lesson confirmation (not at purchase)

**Owner:** Sahil (backend / Stripe) · **Reporter:** frontend · **Type:** payment-model change

---

## Goal

Move the package charge from **purchase time** to **first-lesson confirmation**. Today a player pays for the whole package up front and the money is immediately transferred to the coach — so if the coach becomes unavailable before any lesson, the player is out money and a refund has to claw funds back from the coach's connected account.

Deferring the charge makes this clean and makes the desired refund rule **automatic**:

- **0 lessons taken → nothing was ever charged** (no refund needed).
- **≥1 lesson taken → the package was charged at that first confirmation** (non-refundable, as intended).

## Current behavior (for reference)

`POST /player/packages/:id/purchase` (`routes/player_packages.js`) charges the **full package immediately** and transfers to the coach:

```js
const paymentIntent = await stripe.paymentIntents.create({
  amount: packageCost.amount,            // full package price
  currency: "usd",
  customer: player.stripe_customer_id,
  payment_method: payment_method_id,
  confirm: true,                         // charged now
  off_session: true,
  application_fee_amount: packageCost.platform_fee,
  on_behalf_of: coach.stripe_account_id,
  transfer_data: { destination: coach.stripe_account_id },   // coach paid now
  metadata: { intent_type: "package_purchase", package_id: pkg.id, ... },
});
// then: create purchase row, grant credits_total, status "succeeded"
```

Individual lessons already charge on coach acceptance ("once accepted, your card is charged"), so this change also **makes packages consistent with lessons**.

## Proposed model

### 1. Reserve (was: purchase) — **no charge**
`POST /player/packages/:id/reserve` (or keep `/purchase` but change semantics):
- Require a saved/valid payment method. If the card isn't already saved to the customer, use a **SetupIntent** (`usage: "off_session"`) to save it and satisfy any SCA up front, so the later off-session charge is more likely to succeed without re-auth.
- Create the purchase row with **`status: "reserved"`**, `paid: false`, `charged_payment_intent_id: null`, `credits_total = lesson_count`, `credits_used = 0`, and store `reserved_payment_method_id` + `reserved_at`.
- **Do not** create a PaymentIntent. **Do not** transfer to the coach.
- Credits should not be spendable until paid (see §2) — either don't grant them yet, or grant them flagged `unpaid`.

### 2. Charge on first-lesson confirmation
When the **first** lesson booked against a `reserved` package is **confirmed by the coach** (the existing accept path), before finalizing the lesson:
- Create the PaymentIntent with the **same params as today** (full package amount, `off_session: true`, `application_fee_amount`, `on_behalf_of`, `transfer_data.destination = coach`), using the reserved payment method and an **idempotency key** keyed on the purchase id so it fires exactly once.
- **On success:** mark purchase `status: "active"`, `paid: true`, store the `payment_intent_id`; activate `credits_total`; then confirm the lesson and consume 1 credit as normal.
- **On failure (`card_declined`, `authentication_required`, etc.):** **do NOT confirm the lesson.** Return an actionable error (e.g. `402 { code: "package_charge_failed", requires_action: true }`) so the frontend can prompt the player to update their card / complete 3DS **on-session**, then retry the confirmation. The lesson stays pending until payment clears.

### 3. Subsequent lessons
Package is already paid → consume credits normally (`POST /packages/credits/consume`). No further charges.

## Edge cases / rules

- **Coach unavailable / never confirms** → the reservation simply never charges. No refund path needed.
- **Reservation expiry (recommended):** auto-cancel `reserved` purchases with no confirmed lesson after **N days** (suggest 7–14) so held availability is released. No charge on expiry.
- **Refund rule falls out for free:** because the charge only happens at first confirmation, `credits_used === 0` ⇔ never charged. (If you still want a manual refund escape hatch for edge cases, that's separate — but the normal flow needs none.)
- **Idempotency / double-charge guard:** only the *first* confirmed lesson triggers the charge; guard against concurrent confirmations creating two PaymentIntents.
- **Partial commitment:** charging the **full** package at first confirmation matches the product rule ("take 1 → committed to the package, non-refundable"). Confirm this is the intended amount (full package, not prorated).
- **SCA up front:** doing the SetupIntent at reserve time reduces the odds of `authentication_required` at charge time (off-session). Please still handle the `requires_action` fallback in §2.

## Acceptance criteria

- Reserving a package creates a `reserved` purchase with **no Stripe charge** and **no coach transfer**.
- The **full package** is charged (and transferred to the coach) exactly at the **first lesson's coach-confirmation**, once.
- If that charge fails, the **lesson is not confirmed** and the player gets an actionable error to fix payment.
- A reserved package with 0 confirmed lessons is never charged (and optionally expires after N days).
- After first confirmation: `paid: true`, credits active, subsequent lessons consume credits with no new charge.
- Refunds: not required for the 0-lesson case (never charged); ≥1 lesson is non-refundable by construction.

## Frontend follow-up (context, we'll build after)

- Package CTA changes from "Buy" to **"Reserve"** with copy: *"You won't be charged until your first lesson is confirmed."*
- Handle the `requires_action` / `package_charge_failed` response on the first booking (prompt to update card / complete 3DS, then retry).
- Show reserved-but-unpaid packages distinctly (e.g. "Reserved — charges on first lesson").
- Remove any "request refund" affordance for reserved (unpaid) packages — nothing to refund.

## Notes
- Touches Stripe Connect (destination charges + application fee). Keep the fee/transfer math identical to the current purchase route — only the **timing** and the **trigger** move.
- Coach payout timing shifts from sale → first lesson; flagged as a business decision, already approved on our side.
