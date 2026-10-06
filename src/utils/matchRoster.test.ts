import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlayersNeededForFormat, resolveRosterSizeForFormat } from "./matchRoster";

test("singles and doubles formats use fixed real roster sizes", () => {
  assert.equal(resolveRosterSizeForFormat("singles", 12), 2);
  assert.equal(resolvePlayersNeededForFormat("singles", 11), 1);
  assert.equal(resolveRosterSizeForFormat("doubles", 12), 4);
  assert.equal(resolvePlayersNeededForFormat("doubles", 11), 3);
});

test("flexible formats keep the requested roster size", () => {
  assert.equal(resolveRosterSizeForFormat("dingles", 12), 12);
  assert.equal(resolvePlayersNeededForFormat("round-robin", 5), 5);
});
