import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultCoachProfilePaymentChoice,
  getCoachProfilePaymentOptions,
  resolveCoachAllowsPayOnCourt,
} from "./coachProfilePaymentOptions";

test("includes pay-on-court when coach flag is enabled", () => {
  const options = getCoachProfilePaymentOptions({
    availableCredits: 0,
    applePayReady: false,
    coachAllowsPayOnCourt: true,
  });

  assert.ok(options.some((option) => option.value === "pay-on-court"));
});

test("resolves pay-on-court flag from profile aliases", () => {
  assert.equal(resolveCoachAllowsPayOnCourt({ allow_pay_on_court: true }), true);
  assert.equal(resolveCoachAllowsPayOnCourt({ allowPayOnCourt: true }), true);
  assert.equal(resolveCoachAllowsPayOnCourt({ payment: { allow_pay_on_court: true } }), true);
});

test("defaults to pay-on-court when coach allows it", () => {
  assert.equal(getDefaultCoachProfilePaymentChoice(true), "pay-on-court");
  assert.equal(getDefaultCoachProfilePaymentChoice(false), "card");
});
