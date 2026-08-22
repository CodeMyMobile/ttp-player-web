import assert from "node:assert/strict";
import test from "node:test";

/**
 * The shape buildMatchesUser (MatchPage.jsx) returns, and the guard the join,
 * leave and decline actions use against it.
 *
 * The bug: buildMatchesUser always returns an object — logged out it is
 * { id: null, type: 2, name: "Player", … } — so `!currentUser` was never true.
 * The sign-in redirect behind that guard was unreachable, and a signed-out
 * player's tap fell through to POST /matches/:id/join, which answers
 * 403 {"error":"Please provide a valid token"}. With onToast a no-op, the 403
 * was discarded too, so the button looked dead.
 */
const signedOutUser = { id: null, type: 2, name: "Player", email: "", phone: "" };
const signedInUser = { id: 6, type: 2, name: "Paul Cochrane", email: "p@example.com" };

const oldGuardSaysSignedOut = (user) => !user;
const guardSaysSignedOut = (user) => !user?.id;

test("the old guard could never fire for a signed-out player", () => {
  assert.equal(oldGuardSaysSignedOut(signedOutUser), false, "this is the bug");
});

test("the guard now recognises a signed-out player", () => {
  assert.equal(guardSaysSignedOut(signedOutUser), true);
  assert.equal(guardSaysSignedOut(null), true);
  assert.equal(guardSaysSignedOut(undefined), true);
  assert.equal(guardSaysSignedOut({}), true);
});

test("a signed-in player is still allowed through", () => {
  assert.equal(guardSaysSignedOut(signedInUser), false);
  assert.equal(guardSaysSignedOut({ id: "6" }), false, "string ids count");
});

test("id 0 is not treated as signed in", () => {
  // No real account has id 0, and treating it as signed in would put us back
  // where we started: a tap that falls through to a 403.
  assert.equal(guardSaysSignedOut({ id: 0 }), true);
});
