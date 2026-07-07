# Password Reset SMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send password reset links by SMS when an account has a player or coach phone number, while preserving existing email reset behavior.

**Architecture:** Keep the existing `/api/auth/forgot-password` contract. Add backend helpers for reset URL creation, profile phone lookup, email sending, and SMS best-effort delivery. Update frontend copy only.

**Tech Stack:** Express, SendGrid, Twilio helper `sendMessage`, React, Vite, Jest.

## Global Constraints

- Existing clients keep calling `POST /api/auth/forgot-password` with `{ "email": "..." }`.
- Existing reset links keep using the same server reset route shape currently used by email: `<mailConfig.origin>/auth/reset-password/:token`.
- Existing reset token lifetime remains 1200 seconds.
- Email delivery remains enabled.
- SMS delivery is best effort.
- No request payload changes are required.

---

### Task 1: Backend Reset SMS Delivery

**Files:**
- Modify: `/Users/prem/Projects/Server/ttp-api/routes/auth.js`
- Test: `/Users/prem/Projects/Server/ttp-api/__test__/forgot_password_sms.test.js`

**Interfaces:**
- Consumes: `users.findByEmail(email)`, `sendMessage(phone, message)`, `coachProfile.findById(userId)`, `playerProfile.findById(userId)`
- Produces: same `POST /api/auth/forgot-password` API response contract; optional SMS side effect.

- [ ] Add tests that mock `users`, `@sendgrid/mail`, `utils/textNotification`, `models/player_profile`, and `models/coach_profile`.
- [ ] Implement `buildResetUrl(token)` returning `${mailConfig.origin}/auth/reset-password/${token}`.
- [ ] Implement `findResetPhone(user)` checking player profile first, coach profile second.
- [ ] Send reset SMS when `findResetPhone` returns a phone.
- [ ] Keep response success when SMS fails.
- [ ] Keep email send behavior for all existing callers.

### Task 2: Frontend Copy

**Files:**
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/pages/ForgotPasswordPage.jsx`

**Interfaces:**
- Consumes: existing `forgotPassword(email)` context call.
- Produces: copy that tells users reset instructions may arrive by email or text message.

- [ ] Change intro copy to "Enter the email address associated with your account and we will send a reset link by email or text message when possible."
- [ ] Change success copy to "Password reset instructions have been sent by email or text message if we have a phone number on file."

### Task 3: Verification

**Files:**
- Check only.

**Interfaces:**
- Consumes completed Tasks 1-2.
- Produces verified backend route behavior and frontend build.

- [ ] Run `npx jest __test__/forgot_password_sms.test.js --runInBand` in `/Users/prem/Projects/Server/ttp-api`.
- [ ] Run `node -c routes/forgot_password.js` in `/Users/prem/Projects/Server/ttp-api`.
- [ ] Run `npm run build` in `/Users/prem/Projects/React/ttp-player-web`.

## Self-Review

- Spec coverage: backend SMS, backward compatibility, UI copy, and verification are covered.
- Placeholder scan: no placeholders.
- Type consistency: helper names are local to `routes/forgot_password.js`.
