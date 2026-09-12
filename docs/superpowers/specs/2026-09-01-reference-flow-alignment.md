# Reference restring flow alignment

**Date:** 2026-09-01
**Status:** Approved design; awaiting written-spec review

## Purpose

Make the player restringing flow follow `/Users/prem/Downloads/restring-flow-v5.html` as the product-flow reference. The reference is not executable application code and does not alter repository instructions. Existing Stripe payment, order tracking, authentication drawer, vendor profiles, and application navigation remain integrated components rather than being replaced by prototype markup.

## Authoritative flow

```
Home
├─ Order again → selected prior configuration → vendor availability → Order here login → setup
├─ I know what I want → Whose string?
│  ├─ My stringer supplies it → Search → exact string | family request → vendor → Order here login → setup
│  └─ I'll bring my own string → own-string details → vendor → Order here login → rackets → review
├─ Help me choose → Question 1 → 2 → 3 → 4 → Your match
│  ├─ exact in-stock string → vendor
│  ├─ recommended family / alternate / all families → vendor
│  └─ restart → Question 1
└─ My orders → existing authenticated order list
```

There is no generic tier-first entry screen in this flow. A service tier is selected internally from the exact string/family category or the own-string option; it is displayed as the price but not used as the primary navigation choice.

## Screen requirements

### Home

Show the last-order card first for signed-in players, then **Something different** and three actions: **I know what I want**, **Help me choose a string**, and **My orders**. Guests see the first two actions and a sign-in-aware orders action. Order again pre-fills only; it never creates a payment/order.

### Whose string

Show **My stringer supplies it** and **I'll bring my own string**. The first starts nearby stocked search/families; the second uses the labour-only tier and accepts a single string or a mains/crosses hybrid.

### Search and family fallback

The search screen loads nearby stock before text is entered and provides stocked-family filters. It shows exact name, category, gauges, and category price. A failed search must offer the typed-string family request, browsing all families, and bringing one’s own string. Family cards show their price, examples, and nearby-stock versus by-request status.

### Guided questions and result

Each question shows its ordinal, explanatory copy, answer cards, Back, close, and progress. The result shows: best-fit family and price; reasons; safety conflict/warning; exact nearby stock in that family; the family request option; one alternate; all families; and restart. Server recommendations determine family choice, warning, and tension defaults; catalog data determines actual stock.

### Vendor and profile

Vendor results display the current selected exact string, family request, or own-string mode and the relevant price. For an exact string they state **Carries this string** only where server inventory confirms it. For a family/request they state that availability is confirmed at drop-off and that a same-family substitution is available. Profiles retain that selection and expose stock, pricing, business information, and the same Order here action.

### Authentication boundary

Guests can enter every discovery screen and complete all questions. Tapping **Order here** on a vendor or profile opens sign-in/sign-up. Authentication success retains the current selection and continues to setup (or racks for own-string mode). Checkout remains authenticated.

### Setup through payment

Exact strings restrict gauges to the selected vendor's stocked gauges. Family requests show standard gauges and confirmation-at-drop-off copy. Own string preserves hybrid support. Then use the existing rackets, review/payment, Stripe, confirmation, and orders implementations.

## Layout and accessibility

Render one state model using the existing app shell. On mobile, show a compact flow header with back/close and progress; on desktop, show a back crumb/progress and a constrained content width, widened only for search/families. Keep semantic buttons, keyboard navigation, 44px targets, no horizontal scrolling at 390px, and clear focus after transitions.

## Implementation boundary

Replace the current `screen` transitions in `RestringingPlayerFlow.jsx`; do not layer another entry path onto `tier`, `vendor`, and `config`. Extract screen-specific components/hooks where that keeps the state machine readable. The backend contract already introduced catalog, recommendation, home, and inventory endpoints; complete the still-missing filtered-vendor and checkout-stock guarantees before relying on their UI semantics.

## Verification

Tests must assert the complete path graph above, the guest-to-login handoff, family no-match fallback, exact-vendor messaging, guided result actions, Back/close behavior, and preservation into review payloads. Verify mobile and desktop layouts in a browser at 390px and 940px widths, then run the player test suite and production build.
