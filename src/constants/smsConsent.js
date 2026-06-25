// Shared SMS (TCPA / 10DLC) consent disclosure + payload helper.
//
// This copy is legally significant and must be IDENTICAL across every signup
// surface that collects a phone number (email signup, Google OAuth phone step,
// and the matches sub-app signup). It lives here as a single source of truth so
// the wording can never drift between surfaces.
//
// ⚠️ The disclosure wording must match what is registered in the Twilio 10DLC
// campaign opt-in language. Bump SMS_CONSENT_VERSION whenever this text changes.

export const SMS_CONSENT_VERSION = "2026-06-24";

export const SMS_CONSENT_DISCLOSURE =
  "I agree to receive match-related text messages from The Tennis Plan at the " +
  "number above. Msg & data rates may apply. Msg frequency varies. Reply STOP " +
  "to opt out, HELP for help.";

// Built at submit time so sms_consent_at records the moment the user agreed.
//
// ⚠️ These field names are a contract with the backend. They must match what the
// API persists (Sahil) — if they don't, the value is silently dropped.
export const buildSmsConsentPayload = () => ({
  sms_consent: true,
  sms_consent_at: new Date().toISOString(),
  sms_consent_version: SMS_CONSENT_VERSION,
});
