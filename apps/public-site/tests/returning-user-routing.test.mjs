import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldRedirectReturningUser,
  withLegacySessionCookieCleanup,
  withCookieSensitiveHeaders,
} from "../netlify/returning-user-routing.mjs";

test("returning-user routing redirects only a hinted homepage visitor", () => {
  assert.equal(
    shouldRedirectReturningUser({
      pathname: "/",
      search: "",
      cookie: "locale=en; tp_returning=1; theme=dark",
    }),
    true,
  );
  assert.equal(
    shouldRedirectReturningUser({ pathname: "/", search: "", cookie: "tp_returning=10" }),
    false,
  );
});

test("returning-user routing preserves explicit marketing visits and all non-homepage paths", () => {
  assert.equal(
    shouldRedirectReturningUser({ pathname: "/", search: "?stay=1", cookie: "tp_returning=1" }),
    false,
  );
  assert.equal(
    shouldRedirectReturningUser({
      pathname: "/tennis-lessons/santa-monica",
      search: "",
      cookie: "tp_returning=1",
    }),
    false,
  );
});

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
