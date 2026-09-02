import assert from "node:assert/strict";
import test from "node:test";

import { appRedirectUrl } from "../src/scripts/legacyHashRedirect.mjs";

test("legacy app hashes retain their route when moved to the app host", () => {
  assert.equal(
    appRedirectUrl({ hash: "#/group-lessons/2037", cookie: "" }),
    "https://app.thetennisplan.com/#/group-lessons/2037",
  );
});

test("a returning visitor without a hash route goes to the app root", () => {
  assert.equal(
    appRedirectUrl({ hash: "", cookie: "tp_returning=1; theme=dark" }),
    "https://app.thetennisplan.com/#/",
  );
});

test("stay=1 keeps a returning visitor on the marketing page", () => {
  assert.equal(
    appRedirectUrl({ hash: "", search: "?stay=1", cookie: "tp_returning=1" }),
    null,
  );
});

test("a new visitor or marketing anchor stays on the marketing page", () => {
  assert.equal(appRedirectUrl({ hash: "#coaches", cookie: "" }), null);
  assert.equal(appRedirectUrl({ hash: "", cookie: "" }), null);
});
