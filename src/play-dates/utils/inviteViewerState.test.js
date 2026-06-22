import assert from "node:assert/strict";
import test from "node:test";

import { hasViewerJoinedInvitePreview } from "./inviteViewerState.js";

test("server participant flag marks signed-in invite viewer as joined", () => {
  assert.equal(
    hasViewerJoinedInvitePreview(
      { is_participant: true, viewer_status: "joined", status: "pending" },
      true,
    ),
    true,
  );
});

test("accepted invite status alone is not server joined truth", () => {
  assert.equal(
    hasViewerJoinedInvitePreview(
      { is_participant: false, viewer_status: "accepted", status: "accepted" },
      true,
    ),
    false,
  );
});
