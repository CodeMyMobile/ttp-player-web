import assert from "node:assert/strict";
import test from "node:test";

import { isCurrentUserInMatch } from "./openMatchPlayCardState.js";

test("treats invited current user as already in the match", () => {
  const match = {
    host_id: 6,
    participants: [{ player_id: 6, status: "hosting" }],
    invitees: [{ invitee_id: 10, status: "pending" }],
  };

  assert.equal(isCurrentUserInMatch(match, 10, 6), true);
});

