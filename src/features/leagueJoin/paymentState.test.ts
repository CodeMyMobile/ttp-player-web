import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgreementNudges,
  getJoinSuccessCopy,
  leagueJoinPaymentReducer,
  initialLeagueJoinPaymentState,
} from "./paymentState";

test("agreement cannot continue until signed name and checkbox are set", () => {
  assert.deepEqual(getAgreementNudges({ signedName: "", agreed: false }), {
    signedName: true,
    agreed: true,
  });
  assert.deepEqual(getAgreementNudges({ signedName: "Sahil Player", agreed: false }), {
    signedName: false,
    agreed: true,
  });
  assert.deepEqual(getAgreementNudges({ signedName: "Sahil Player", agreed: true }), {
    signedName: false,
    agreed: false,
  });
});

test("payment reducer moves from authorization to completion and success", () => {
  const authorizing = leagueJoinPaymentReducer(initialLeagueJoinPaymentState, {
    type: "authorize_started",
  });
  assert.equal(authorizing.step, "payment");
  assert.equal(authorizing.status, "authorizing");

  const completing = leagueJoinPaymentReducer(authorizing, {
    type: "authorized",
    attemptId: "attempt-1",
    paymentIntentId: "pi_123",
  });
  assert.equal(completing.status, "completing");
  assert.equal(completing.attemptId, "attempt-1");
  assert.equal(completing.paymentIntentId, "pi_123");

  const success = leagueJoinPaymentReducer(completing, {
    type: "completed",
    membershipId: 88,
    seeded: true,
    startingRating: 5,
  });
  assert.equal(success.step, "success");
  assert.equal(success.status, "complete");
  assert.equal(success.membershipId, 88);
});

test("retryable payment errors keep the user on payment", () => {
  const errored = leagueJoinPaymentReducer(initialLeagueJoinPaymentState, {
    type: "payment_failed",
    message: "Card was declined.",
  });

  assert.equal(errored.step, "payment");
  assert.equal(errored.status, "error");
  assert.equal(errored.error, "Card was declined.");
});

test("last-spot race returns to browse with not-charged copy", () => {
  const state = leagueJoinPaymentReducer(initialLeagueJoinPaymentState, {
    type: "league_full_not_charged",
  });

  assert.equal(state.step, "browse");
  assert.equal(state.status, "error");
  assert.match(state.error || "", /not charged/i);
});

test("success copy distinguishes first-join seed results", () => {
  assert.match(
    getJoinSuccessCopy({ seeded: true, startingRating: 5 }),
    /starting rating is 5/,
  );
  assert.match(
    getJoinSuccessCopy({ seeded: false }),
    /existing rating/i,
  );
});
