# Password Reset SMS Design

## Goal

When a player or coach requests a password reset, send the reset link by SMS as well as email when the account has a phone number on file. This reduces failures when reset emails are blocked.

## Backward Compatibility

Existing clients keep calling `POST /api/auth/forgot-password` with `{ "email": "..." }`. Existing reset links keep using the same server reset route shape currently used by email: `<mailConfig.origin>/auth/reset-password/:token`. Existing reset token lifetime remains 1200 seconds. Email delivery remains enabled.

## Backend Behavior

The active forgot-password handler in `routes/auth.js` finds the user by email, creates the same JWT reset token, builds one web reset URL, sends email to the requested account email, and sends SMS to the user's profile phone if available. Player phone is read from `player_profile` by `user_id`; coach phone is read from `coach_profile` by `user_id`.

SMS delivery is best effort. If email sends and SMS fails, the API still returns success and logs the SMS failure. If no phone exists, the API still returns success after email.

The response should avoid account enumeration for successful client behavior. It can return a generic success detail for both email-only and email+SMS delivery.

## Frontend Behavior

The forgot password page text changes from "inbox" to "email or text message." No request payload changes are required.

## Testing

Backend tests cover SMS sent for a player phone, SMS sent for a coach phone, no SMS when no phone exists, and email-only compatibility. Frontend verification is a build because UI copy is static.
