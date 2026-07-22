import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultCoachProfilePaymentChoice,
  getCoachProfilePaymentOptions,
  resolveCoachAllowsPayOnCourt,
  resolveCoachCanAcceptCards,
} from "./coachProfilePaymentOptions";

test("includes pay-on-court when coach flag is enabled", () => {
  const options = getCoachProfilePaymentOptions({
    availableCredits: 0,
    applePayReady: false,
    coachAllowsPayOnCourt: true,
    coachCanAcceptCards: true,
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

test("resolves card availability from coach Stripe fields", () => {
  assert.equal(resolveCoachCanAcceptCards({ stripe_account_id: "acct_123", charges_enabled: true }), true);
  assert.equal(resolveCoachCanAcceptCards({ stripe_account_id: "acct_123", charges_enabled: false }), false);
  assert.equal(resolveCoachCanAcceptCards({ payment: { stripe_account_id: "acct_123", charges_enabled: true } }), true);
  assert.equal(resolveCoachCanAcceptCards({}), true);
});

test("disables card and wallet when coach cannot accept Stripe", () => {
  const options = getCoachProfilePaymentOptions({
    availableCredits: 0,
    applePayReady: true,
    coachAllowsPayOnCourt: true,
    coachCanAcceptCards: false,
  });

  assert.equal(options.find((option) => option.value === "card")?.enabled, false);
  assert.equal(options.find((option) => option.value === "wallet")?.enabled, false);
  assert.equal(options.find((option) => option.value === "pay-on-court")?.enabled, true);
});
