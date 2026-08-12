import assert from "node:assert/strict";
import test from "node:test";
import { claimTokenFromSearch } from "./claimRoute.js";

test("claimTokenFromSearch reads the opaque token", () => {
  assert.equal(claimTokenFromSearch("?token=Tq7wN2mK9rXcV4bZjF8dHs"), "Tq7wN2mK9rXcV4bZjF8dHs");
});

test("claimTokenFromSearch ignores old order and phone query links", () => {
  assert.equal(claimTokenFromSearch("?order=32&phone=%2B424333206"), "");
});
