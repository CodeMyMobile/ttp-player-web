import assert from "node:assert/strict";
import test from "node:test";

import { canReceiveHitRequest, hitRequestErrorCode, hitRequestErrorMessage } from "./useHitRequest";

test("offers the request only when the API says the player can receive one", () => {
  assert.equal(canReceiveHitRequest({ can_receive_hit_request: true }), true);
  assert.equal(canReceiveHitRequest({ can_receive_hit_request: false }), false);
  // A phone alone, or an API without the flag, is not enough.
  assert.equal(canReceiveHitRequest({ phone: "3105550123" } as { can_receive_hit_request?: unknown }), false);
  assert.equal(canReceiveHitRequest(null), false);
});

test("reads the API's error code and explains each refusal", () => {
  assert.equal(hitRequestErrorCode({ data: { error: "hit_request_recent" } }), "hit_request_recent");
  assert.equal(hitRequestErrorCode(new Error("network")), undefined);
  assert.equal(hitRequestErrorMessage("hit_request_recent", "Maria"), "You asked Maria recently. Give them a few days.");
  assert.match(hitRequestErrorMessage("already_connected", "Maria"), /already connected with Maria/);
  assert.match(hitRequestErrorMessage("sender_phone_required", "Maria"), /Add a mobile number/);
  assert.match(hitRequestErrorMessage("player_phone_unavailable", "Maria"), /MatchPlay invite/);
  assert.equal(hitRequestErrorMessage(undefined, "Maria"), "Couldn't send the request. Please try again.");
});
