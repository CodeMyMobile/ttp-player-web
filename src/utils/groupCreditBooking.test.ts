import assert from "node:assert/strict";
import test from "node:test";

import { requiresExistingParticipantForCredits } from "./groupCreditBooking";

test("open group lessons do not need a participant row up front", () => {
  assert.equal(requiresExistingParticipantForCredits(3), false);
  assert.equal(requiresExistingParticipantForCredits("3"), false);
});

test("restricted group lessons do need one", () => {
  assert.equal(requiresExistingParticipantForCredits(4), true);
});

/**
 * The permissive path exists only because the backend implements it for type 3.
 * Anything we cannot identify stays on the strict path rather than reserving a
 * credit that confirm would refuse to finalise.
 */
test("an unknown lesson type is treated as restricted", () => {
  assert.equal(requiresExistingParticipantForCredits(undefined), true);
  assert.equal(requiresExistingParticipantForCredits(null), true);
  assert.equal(requiresExistingParticipantForCredits(0), true);
});
