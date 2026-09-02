import assert from "node:assert/strict";
import test from "node:test";

import { withLegacySessionCookieCleanup, withCookieSensitiveHeaders } from "../netlify/returning-user-routing.mjs";

test("homepage responses cannot be shared across cookie states", () => {
  const headers = withCookieSensitiveHeaders(
    new Headers({ "cache-control": "public, max-age=31536000", vary: "Accept-Encoding" }),
  );

  assert.equal(headers.get("cache-control"), "no-store");
  assert.equal(headers.get("vary"), "Accept-Encoding, Cookie");
});

test("homepage responses retire legacy parent-domain session cookies", () => {
  const headers = withLegacySessionCookieCleanup(new Headers());

  assert.deepEqual(headers.getSetCookie(), [
    "authToken=; Domain=.thetennisplan.com; Path=/; Max-Age=0; SameSite=Lax; Secure",
    "refreshToken=; Domain=.thetennisplan.com; Path=/; Max-Age=0; SameSite=Lax; Secure",
  ]);
});
