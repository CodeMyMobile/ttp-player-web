import assert from "node:assert/strict";
import test from "node:test";

import { canReceiveIntro, introErrorMessage } from "./usePlayerIntro";

test("offers the intro only when the API says the player can receive one", () => {
  assert.equal(canReceiveIntro({ can_receive_intro: true }), true);
  assert.equal(canReceiveIntro({ can_receive_intro: false }), false);
  // An API without the flag (or a phone alone) is not enough.
  assert.equal(canReceiveIntro({ phone: "3105550123" } as { can_receive_intro?: unknown }), false);
  assert.equal(canReceiveIntro(null), false);
});

test("explains each refusal in plain words", () => {
  assert.equal(introErrorMessage("intro_already_sent", "Maria"), "You already sent Maria an intro this week.");
  assert.match(introErrorMessage("intro_limit_reached", "Maria"), /10 intros today/);
  assert.match(introErrorMessage("player_phone_unavailable", "Maria"), /MatchPlay invite/);
  assert.equal(introErrorMessage(undefined, "Maria"), "Couldn't send the intro. Please try again.");
});
