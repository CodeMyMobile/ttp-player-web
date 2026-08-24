import assert from "node:assert/strict";
import test from "node:test";

import { isSessionTokenPayloadValid } from "./auth.js";

const tokenWithPayload = (payload) =>
  `header.${btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.signature`;

test("isSessionTokenPayloadValid rejects the malformed tokens issued by the old refresh endpoint", () => {
  assert.equal(isSessionTokenPayloadValid(tokenWithPayload({ data: { id: 123 } })), false);
  assert.equal(isSessionTokenPayloadValid(tokenWithPayload({ data: [{ id: 123 }] })), true);
});
