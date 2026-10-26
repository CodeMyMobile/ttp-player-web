import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProfileUrl,
  buildShareText,
  forgetProfileRef,
  joinCourts,
  normalizeProfileSlug,
  readProfileRef,
  rememberProfileRef,
} from "./publicProfileLink.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

test("accepts only lowercase hyphenated slugs", () => {
  assert.equal(normalizeProfileSlug(" Paul-C "), "paul-c");
  assert.equal(normalizeProfileSlug("paul-c-2"), "paul-c-2");
  assert.equal(normalizeProfileSlug("../admin"), null);
  assert.equal(normalizeProfileSlug("paul--c"), null);
  assert.equal(normalizeProfileSlug(""), null);
});

test("builds a path link, not a hash route", () => {
  assert.equal(buildProfileUrl("paul-c", "https://app.thetennisplan.com/"), "https://app.thetennisplan.com/p/paul-c");
  assert.equal(buildProfileUrl("bad slug", "https://app.thetennisplan.com"), "");
});

test("writes the share text from rating and courts", () => {
  assert.equal(
    buildShareText({ rating: "4.5", homeCourts: ["Penmar", "Fox Hills"] }),
    "Want to hit? Here's my Tennis Plan profile (4.5, usually at Penmar & Fox Hills)",
  );
  assert.equal(buildShareText({ rating: null, homeCourts: [] }), "Want to hit? Here's my Tennis Plan profile");
  assert.equal(joinCourts(["A", "B", "C"]), "A, B & C");
});

test("remembers a referral for 30 days", () => {
  const storage = memoryStorage();
  const start = Date.UTC(2026, 9, 1);
  rememberProfileRef("Paul-C", storage, start);

  assert.equal(readProfileRef(storage, start + 29 * 86400000), "paul-c");
  assert.equal(readProfileRef(storage, start + 31 * 86400000), null);
  forgetProfileRef(storage);
  assert.equal(readProfileRef(storage, start), null);
});
