import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSharePhone,
  phoneContactHref,
  SHARE_PHONE_LABEL,
} from "./privacy.js";

test("phone sharing defaults off and keeps the approved setting copy", () => {
  assert.equal(normalizeSharePhone(undefined), false);
  assert.equal(normalizeSharePhone(null), false);
  assert.equal(normalizeSharePhone(true), true);
  assert.equal(SHARE_PHONE_LABEL, "Share my phone with confirmed match partners");
});

test("redacted partner data produces no phone contact link", () => {
  assert.equal(phoneContactHref(undefined), "");
  assert.equal(phoneContactHref(""), "");
  assert.equal(phoneContactHref("(555) 123-4567"), "tel:+15551234567");
});
