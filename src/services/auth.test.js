import assert from "node:assert/strict";
import test from "node:test";

import { isSessionTokenPayloadValid, persistAuthSession } from "./auth.js";

const tokenWithPayload = (payload) =>
  `header.${btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.signature`;

test("isSessionTokenPayloadValid rejects the malformed tokens issued by the old refresh endpoint", () => {
  assert.equal(isSessionTokenPayloadValid(tokenWithPayload({ data: { id: 123 } })), false);
  assert.equal(isSessionTokenPayloadValid(tokenWithPayload({ data: [{ id: 123 }] })), true);
});

test("persistAuthSession marks a successful player session as returning", () => {
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const cookies = [];
  const values = new Map();
  globalThis.document = {
    set cookie(value) {
      cookies.push(value);
    },
  };
  globalThis.localStorage = {
    setItem(key, value) {
      values.set(key, value);
    },
  };

  try {
    persistAuthSession({ access_token: "player-token" });

    assert.equal(values.get("authToken"), "player-token");
    assert.deepEqual(cookies, [
      "tp_returning=1; Domain=.thetennisplan.com; Path=/; Max-Age=7776000; SameSite=Lax; Secure",
    ]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousLocalStorage;
  }
});
