import assert from "node:assert/strict";
import test from "node:test";

import {
  SMS_DISCLOSURE_VERSION,
  buildSmsConsentPayload,
  resolveSmsConsentGranted,
  withSmsConsent,
} from "./smsConsent.js";

test("buildSmsConsentPayload returns the backend consent record shape", () => {
  const payload = buildSmsConsentPayload("signup_checkbox");

  assert.equal(payload.granted, true);
  assert.equal(payload.disclosureVersion, SMS_DISCLOSURE_VERSION);
  assert.match(payload.disclosureText, /text|SMS/i);
  assert.equal(payload.method, "signup_checkbox");
});

test("withSmsConsent only attaches consent when explicitly granted", () => {
  assert.deepEqual(withSmsConsent({ phone: "4155550101" }, false), {
    phone: "4155550101",
  });

  const payload = withSmsConsent({ phone: "4155550101" }, true, "oauth_phone_capture");
  assert.equal(payload.smsConsent.granted, true);
  assert.equal(payload.smsConsent.method, "oauth_phone_capture");
});

test("resolveSmsConsentGranted reads boolean and nested consent shapes", () => {
  assert.equal(resolveSmsConsentGranted({ smsConsentGranted: true }), true);
  assert.equal(resolveSmsConsentGranted({ sms_consent_granted: true }), true);
  assert.equal(resolveSmsConsentGranted({ smsConsent: { granted: true } }), true);
  assert.equal(resolveSmsConsentGranted({ sms_consent: { granted: true } }), true);
  assert.equal(resolveSmsConsentGranted({ smsConsent: { granted: false } }), false);
  assert.equal(resolveSmsConsentGranted({}), false);
});
