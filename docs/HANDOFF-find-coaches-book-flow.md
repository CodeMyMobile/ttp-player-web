# Handoff: Find-coaches → Book-a-lesson flow

## What this is
A clickable prototype lives at `docs/find-coach-to-book-flow.html`. It is a **design spec**, not code to paste — it's vanilla HTML/CSS/JS and our app is React/Vite/Tailwind. Read it for layout, spacing, color logic, copy, and interaction behavior, then implement natively in our component system. Match the prototype's look and behavior; don't port its markup verbatim.

Before writing code, open the prototype, click through the whole flow (find-coaches → tap "Book a lesson" → tab between Private/Group/All → tap a slot → the confirm-and-pay drawer → "Send request" → the pending confirmation page), and read the inline `<script>` for the slot-rendering logic. That logic is the spec for the trickiest part.

## How I'd like to work this
Plan-mode first — investigate the existing components and propose an approach before changing anything. Then ship as **small, isolated PRs**, not one big drop. Suggested split:
1. Find-coaches matched-mode + extract the redesigned card as a shared `CoachMatchCard` component (post-questionnaire framing in `FindCoaches.tsx`; resolve the `/coach-match/recommendations` question — see "Where it lives" below)
2. Book-a-lesson slot list (the period-bucketing + attribute-hoisting logic)
3. Confirm-and-pay drawer (single drawer, replaces the old two-screen flow)
4. Pending confirmation page

Never display data the app can't truthfully back — if a field isn't wired yet, don't fake it in the UI.

---

## Screen 1 — Find-coaches (post-questionnaire state)

### Where it lives (decided)
Build this as a **matched-mode within the existing `src/pages/FindCoaches.tsx`**, not as a separate page. FindCoaches already owns the coach fetch, match-scoring, reason derivation, and the questionnaire edit/clear wiring — the "Your matches" experience is a *state* of that page, not a new capability. When the questionnaire is complete: hide search + filters, swap in the "Your matches" header/framing, and render the redesigned card. Reuse all existing fetch/match/edit/clear logic — do not duplicate it.

**Do NOT** build this on the separate `/coach-match/recommendations` page — routing post-questionnaire users there would fork the match logic into two components, which will drift. 

Two required follow-ups:
1. **Extract the card as a shared component** (e.g. `CoachMatchCard`) so it's defined once. Even if the recommendations page survives, both surfaces import the same card — never reimplement it.
2. **Resolve what `/coach-match/recommendations` is for** before/as part of this work. Either (a) it's now redundant → deprecate or redirect it into FindCoaches matched-mode (check what links to it first), or (b) it's a genuinely distinct surface (e.g. a richer "top 3 with deep explanations" moment) → it stays, but it imports the shared `CoachMatchCard`. Flag which one; don't leave two divergent matched experiences.

This is the page a player lands on **after completing the 5-step match questionnaire**. So:
- No search bar, no filters — they already told us everything.
- Title "Your matches" / "12 coaches, ranked just for you".
- A "Matched from your answers" eyebrow + an **Edit** pill (routes back into the questionnaire).
- Their answers shown as a single compact, horizontally-scrollable row of **outlined, squared, muted labels** (level, goals, budget, format). These are labels, NOT buttons — no fill, no pill shape. Only Edit is interactive.

### Coach card
Top: photo, name, distance, and a match % badge (emerald). Then, in order:
- **Credibility band** (soft purple tint): cert badge `USPTA ELITE` (white-on-purple, uppercase), years coaching, players coached. These replace the old "New coach" flag — never show "new coach".
- **Two meta rows** (plain text on white, purple icons): "Usually replies within 24 hours", "Teaches intermediate adults (3.5–4.5)".
- **"Why NN% match" box** (green tint): 3 checkmarked items naming the matched specialties in bold (e.g. "Specializes in **doubles strategy**"). These come from the match algorithm — show the specific specialties that matched the player's questionnaire answers, not a generic list.
- **Budget block** (plain, not boxed): "IN YOUR BUDGET" tag + a `NO LESSON COMMISSION` chip, the in-budget option, and the alt option.
- Short bio, then two buttons: **See profile** (ghost) and **Book a lesson** (purple primary).

"Book a lesson" navigates to Screen 2 for that coach. "See profile" → existing coach profile route.

---

## Screen 2 — Book a lesson
Removed "Where you'll play" (location is per-slot, so it was redundant). Page is:
1. "Book a lesson with {coach}" eyebrow
2. Tabs: **Private / Group / All** (Private is the default/lead tab)
3. Horizontal date strip — each date chip shows day, date, and open-slot count; selected = purple fill; days with 0 open are dashed and disabled.
4. A slim green reassurance line: **"No lesson commission. Coaches keep their full rate — the fees cover booking and card costs."**
5. The slot list.

### Slot list — this is the important part
Slots are grouped by **time-of-day period** (morning / afternoon / evening). Read the prototype's `renderSlots()` for the exact behavior. Two rules:

**(a) Hoist shared attributes to the section header.** For each period block, check whether `location`, `duration`, and `price` are identical across all slots in that block. Any attribute that's uniform shows ONCE in the section header (e.g. "MORNING · 5 — Cheviot Hills Tennis · 1 hr · $135"). Any attribute that VARIES drops back onto the individual rows. So a clean block → clean time-only rows; a mixed-location block → location reappears per row. This is graceful degradation; don't hardcode it, compute it from the data.

**(b) Time is the hero.** Each slot's time renders as a tappable tinted **pill** — the primary control. When everything's hoisted, rows are essentially just the time pill + chevron. Price, when it varies, sits demoted on the trailing right (15px, not bold). Per-row type badges (PRIVATE/GROUP) appear ONLY in the All tab — in the Private/Group tabs the tab already states the type, so the badge is noise.

### Period theming
Each period has a quiet color identity applied to the time pill tint, the card's left-border accent, and a small icon in the section header:
- Morning → amber (sunrise icon)
- Afternoon → blue (sun icon)
- Evening → purple (moon icon)

⚠️ The prototype keys periods off a `tod` string in the mock data. **The real API likely returns timestamps** — bucket them client-side (e.g. before 12:00 = morning, 12:00–17:00 = afternoon, after 17:00 = evening) so theming maps automatically. Decide where that helper lives.

Group slots additionally show class name, level, and spots-left on the row (these vary, so they stay per-row).

Tapping any slot opens the drawer (Screen 3).

---

## Screen 3 — Confirm-and-pay drawer (single drawer)
**Important: this replaces a buggy two-step flow.** Previously tapping a slot opened a details drawer, and tapping again opened a separate confirm-and-pay page that repeated the same details. Collapse to ONE drawer. Tapping a slot goes straight here.

Contents:
- Lesson summary card: coach, type, date/time, duration, location (+ class/spots for group).
- Payment method list: lesson-package upsell, Apple Pay, saved cards (one pre-selected), add card.
- **Itemized fee breakdown** (see below).
- Sticky footer: total + **"Send request"** + "Chris usually responds within 24 hours".

### Fee breakdown — wire to backend
The prototype computes fees client-side as placeholders. **Do not compute fees in the frontend.** The API should return the line items and the grand total; the UI just renders them, so what's displayed always equals what Stripe charges. Current rates for reference (confirm with backend, treat as server config, not constants):
- Booking fee: **$1 flat**
- Card processing: **3%** (of lesson + booking fee)
- Display: Lesson / Booking fee / Card processing / **Total**
- Note under the total: "No lesson commission. Coaches keep their full rate — the fees cover booking and card costs."

The one-time finder's fee (taken from the coach's first-lesson payout) must NOT appear anywhere in the player flow — it's coach-side only. The player never sees it.

---

## Screen 4 — Pending confirmation page (after "Send request")
Because **the coach must approve**, this is a *pending* state, not a "booked" confirmation. Use amber, not green (green reads as done; this isn't).
- Amber clock icon + `PENDING · awaiting {coach}` pill.
- "Request sent to {coach}" / "Your lesson isn't booked just yet — {coach} reviews every request personally, usually within 24 hours."
- Reservation summary card (type, when, where, total) + a "View lesson reservation" link → the reservation detail route.
- One quiet line: "{coach} reviews each request to check his schedule and make sure it's the right fit." (Keep it short — don't turn this into a marketing block.)
- "What happens next" — 3 steps: (1) coach reviews ~24h, (2) once accepted, card is charged + lesson confirmed, (3) free to cancel up to 24h before, full refund.
- Footer: "View my reservation" (primary) + "Back to coaches" (ghost).

On send, the slot becomes a `REQUESTED` state in the list (badge, dimmed, no longer tappable).

---

## Open backend questions to resolve (flag these, don't guess)
1. **Stripe capture timing.** The confirmation says "once accepted, your card is charged" and "free to cancel, full refund." That's only accurate if we authorize-on-request and **capture on coach acceptance** (and that the cancellation window allows a real refund). Confirm the actual capture flow with the backend; if we charge upfront instead, the confirmation copy must change so it stays truthful.
2. **Fee source.** Confirm `bookingFee`, `cardFee`, `total` are returned by the booking/quote endpoint, not computed client-side.
3. **Period bucketing.** Confirm whether the slots endpoint returns a period label or raw timestamps (drives where the morning/afternoon/evening helper lives).
4. **Match reasons.** The "Why NN% match" items should come from the match endpoint as the specific matched specialties, so the card reflects real questionnaire alignment rather than static copy.
5. **Coach availability** feeding the slots — confirm the source (coach calendar sync vs. manual) and that locations are per-slot.

## Copy guardrails (don't drift from these)
- Never "no fees" / "no markup" / "keeps 100% of what you pay" — there ARE booking + card fees the player pays. The only true claim is **no commission on lessons**.
- Never "New coach" as a flag — lead with certifications instead.
- The fee-framing sentence is fixed and identical everywhere it appears: *"No lesson commission. Coaches keep their full rate — the fees cover booking and card costs."*

## Design tokens (from prototype `:root`)
Purple `#7C3AED` (primary), purple-tint `#EDE9FE`, green/emerald accents for the match + commission messaging, blue `#378ADD` for group, amber for pending/warning. Font: the app's existing system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display"…`) — the prototype uses a single `--font` var; match whatever the app already loads. Bold weight is 700 (not 800). Cards 12–16px radius, hairline borders.
