# Pay Link Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a same-domain `/pay/:token` walk-in checkout route that replaces hosted Stripe Checkout with a branded, mobile-first Payment Element flow.

**Architecture:** The API remains bearer-token based for viewing and paying, with optional auth only used to decide whether account-save messaging is visible. The frontend adds a chrome-free route that fetches a masked public summary, creates/reuses a connected-account PaymentIntent, renders Express Checkout above the Payment Element, and switches to a local success state after Stripe confirms.

**Tech Stack:** Vite React 19, react-router-dom, `@stripe/react-stripe-js`, `@stripe/stripe-js`, Express, Stripe Node SDK, node:test/Jest tests.

## Global Constraints

- Same domain route: support `/pay/{token}` and `#/pay/{token}` without requiring login.
- PII: show first name, masked phone, and order details only; never render full phone or email.
- Account prompt: render only when the server says the order phone matches an existing non-lightweight Tennis Plan account; hide it for logged-in non-matching users.
- Stripe: create/reuse PaymentIntent on the connected vendor account; allow card, Apple Pay, Google Pay, and Link; disable hosted Checkout for new walk-in links.
- Payment methods UI: Express Checkout first, then Payment Element, then violet Pay button.
- Success: show confirmation, receipt note, and three next-step rows.
- Demo controls: only in dev or `?demo=1`; wallet/pay controls may jump to local success in demo mode.

---

### Task 1: Backend Pay-Link Contract

**Files:**
- Modify: `/Users/prem/Projects/Server/ttp-api/routes/restringing_pay_links.js`
- Modify: `/Users/prem/Projects/Server/ttp-api/src/services/restringingPayments.js`
- Modify: `/Users/prem/Projects/Server/ttp-api/__test__/restringing_pay_links.test.js`

**Interfaces:**
- Produces `GET /api/restringing/pay-links/:token -> { order, vendor, account_link }`
- Produces `POST /api/restringing/pay-links/:token/checkout -> { client_secret, stripe_account_id }`

- [x] Write failing route tests for richer masked summary, no full email/phone, account prompt hiding for logged-in mismatch, and connected-account checkout.
- [x] Update public summary builder to include first name, masked phone, vendor address/hours/phone, full item descriptions, totals, and account-link status.
- [x] Change walk-in payment link URL generation to same-domain `/pay/:token`.
- [x] Change PaymentIntent creation to direct connected-account mode with `payment_method_types: ["card", "link"]`.
- [x] Run backend pay-link tests.

### Task 2: Frontend API + Formatting Layer

**Files:**
- Create: `/Users/prem/Projects/React/ttp-player-web/src/api/restringingPayLinks.ts`
- Create: `/Users/prem/Projects/React/ttp-player-web/src/api/restringingPayLinks.test.ts`

**Interfaces:**
- Produces `getRestringingPayLink(token, authToken?)`
- Produces `createRestringingPayLinkCheckout(token, authToken?)`
- Produces formatting helpers for amount, phone, vendor tel URL, item specs, and account prompt state.

- [x] Write failing node tests for formatting helpers and request paths.
- [x] Implement API calls with optional auth token and no full PII rendering helpers.
- [x] Run frontend API tests.

### Task 3: Pay Link Page UI

**Files:**
- Create: `/Users/prem/Projects/React/ttp-player-web/src/pages/PayLinkCheckoutPage.tsx`
- Create: `/Users/prem/Projects/React/ttp-player-web/src/pages/PayLinkCheckoutPage.css`
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/App.jsx`

**Interfaces:**
- Consumes Task 2 API helpers.
- Produces focused checkout route rendered for direct `/pay/:token` and hash `#/pay/:token`.

- [x] Add route bridge before `HashRouter` for clean same-domain `/pay/:token`.
- [x] Build loading/error states, branded header, greeting, order summary, optional account card, Stripe section, success screen, and dev demo controls.
- [x] Use `ExpressCheckoutElement` and `PaymentElement` with Inter/violet appearance; confirm with `stripe.confirmPayment({ redirect: "if_required" })`.
- [x] Run lint/build.

### Task 4: Verification

**Files:**
- Verify changed frontend and backend files.

- [x] Run frontend targeted tests and build.
- [x] Run backend pay-link tests.
- [x] Start local frontend dev server and inspect `/pay/demo-token?demo=1` fallback behavior if backend is unavailable.
