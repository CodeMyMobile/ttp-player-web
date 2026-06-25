import assert from "node:assert/strict";
import test from "node:test";

import {
  SMS_CONSENT_VERSION,
  SMS_CONSENT_DISCLOSURE,
  buildSmsConsentPayload,
} from "./smsConsent.js";

// These field names are a backend contract — assert them explicitly so a rename
// can't silently drop the consent record. (See the pre-merge blockers in the PR.)
test("buildSmsConsentPayload emits exactly the three contract fields", () => {
  const payload = buildSmsConsentPayload();
  assert.deepEqual(Object.keys(payload).sort(), [
    "sms_consent",
    "sms_consent_at",
    "sms_consent_version",
  ]);
});

test("buildSmsConsentPayload records affirmative consent + version", () => {
  const payload = buildSmsConsentPayload();
  assert.equal(payload.sms_consent, true);
  assert.equal(payload.sms_consent_version, SMS_CONSENT_VERSION);
});

test("sms_consent_at is an ISO-8601 timestamp", () => {
  const { sms_consent_at } = buildSmsConsentPayload();
  assert.match(sms_consent_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(Number.isNaN(Date.parse(sms_consent_at)), false);
});

test("disclosure includes the required STOP/HELP + rates language", () => {
  assert.match(SMS_CONSENT_DISCLOSURE, /Reply STOP to opt out/);
  assert.match(SMS_CONSENT_DISCLOSURE, /HELP for help/);
  assert.match(SMS_CONSENT_DISCLOSURE, /Msg & data rates may apply/);
  assert.match(SMS_CONSENT_DISCLOSURE, /Msg frequency varies/);
});
