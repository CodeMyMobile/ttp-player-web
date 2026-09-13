import assert from "node:assert/strict";
import test from "node:test";

import { shouldHideRestrictedMatch } from "./restrictedMatchVisibility.js";

test("an ordinary listed match is never hidden", () => {
  assert.equal(shouldHideRestrictedMatch({}), false);
  assert.equal(shouldHideRestrictedMatch({ isHost: false, isJoined: false }), false);
});

test("a stranger's private or link-only match is hidden", () => {
  assert.equal(shouldHideRestrictedMatch({ isPrivate: true }), true);
  assert.equal(shouldHideRestrictedMatch({ isLinkOnly: true }), true);
});

test("the host, a joined player and an invitee all keep seeing it", () => {
  assert.equal(shouldHideRestrictedMatch({ isLinkOnly: true, isHost: true }), false);
  assert.equal(shouldHideRestrictedMatch({ isLinkOnly: true, isJoined: true }), false);
  assert.equal(shouldHideRestrictedMatch({ isLinkOnly: true, isInvited: true }), false);
});

/**
 * The case this rule exists for: a link-only match the player joined, on the tab
 * the API scoped to them. Client-side identity matching is unreliable here, so
 * an unrecognised viewer must not cost them the row.
 */
test("a server-scoped row is kept even when the viewer cannot be recognised", () => {
  assert.equal(
    shouldHideRestrictedMatch({
      isLinkOnly: true,
      isHost: false,
      isJoined: false,
      isInvited: false,
      serverScopedToViewer: true,
    }),
    false,
  );
  assert.equal(
    shouldHideRestrictedMatch({ isPrivate: true, serverScopedToViewer: true }),
    false,
  );
});

test("an unscoped tab still relies on the derivation", () => {
  assert.equal(
    shouldHideRestrictedMatch({ isLinkOnly: true, serverScopedToViewer: false }),
    true,
  );
});
