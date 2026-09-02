import assert from "node:assert/strict";
import test from "node:test";

import { clearLegacySharedAuthCookies } from "./authToken.js";

test("clearLegacySharedAuthCookies expires old parent-domain session cookies", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const writes = [];
  globalThis.document = {
    set cookie(value) {
      writes.push(value);
    },
  };
  globalThis.window = { location: { hostname: "app.thetennisplan.com", protocol: "https:" } };

  try {
    clearLegacySharedAuthCookies();

    assert.deepEqual(writes, [
      "authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Domain=.app.thetennisplan.com; Secure",
      "authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Domain=.thetennisplan.com; Secure",
      "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Domain=.app.thetennisplan.com; Secure",
      "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Domain=.thetennisplan.com; Secure",
    ]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
