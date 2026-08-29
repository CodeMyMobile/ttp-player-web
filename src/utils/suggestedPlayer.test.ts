import assert from "node:assert/strict";
import { test } from "node:test";

import { isMeaningfulBio, mapSuggestedPlayer } from "./suggestedPlayer";

test("a real bio is meaningful", () => {
  assert.equal(isMeaningfulBio("Been playing since college, looking for weekend hits."), true);
  assert.equal(isMeaningfulBio("I play doubles"), true);
});

test("filler answers collapse", () => {
  // These appear verbatim in the data — typed to get past a required field.
  assert.equal(isMeaningfulBio("Nil"), false);
  assert.equal(isMeaningfulBio("Qwerty"), false);
  assert.equal(isMeaningfulBio("N/A"), false);
  assert.equal(isMeaningfulBio("test"), false);
  assert.equal(isMeaningfulBio("asdf"), false);
  assert.equal(isMeaningfulBio("..."), false);
});

test("a single token is never a bio", () => {
  assert.equal(isMeaningfulBio("Tennis"), false);
  assert.equal(isMeaningfulBio("  Hitting  "), false);
});

test("empty and non-string collapse", () => {
  assert.equal(isMeaningfulBio(""), false);
  assert.equal(isMeaningfulBio("   "), false);
  assert.equal(isMeaningfulBio(null), false);
  assert.equal(isMeaningfulBio(undefined), false);
  assert.equal(isMeaningfulBio(42), false);
});

test("the mapper no longer substitutes a placeholder sentence", () => {
  // Regression: it used to return "This player hasn't added a bio yet.", which meant
  // an absent bio could never be detected downstream.
  assert.equal(mapSuggestedPlayer({ userId: 1, full_name: "A B" } as never).bio, "");
  assert.equal(mapSuggestedPlayer({ userId: 1, full_name: "A B", about_me: "  " } as never).bio, "");
  assert.equal(
    mapSuggestedPlayer({ userId: 1, full_name: "A B", about_me: " I play doubles " } as never).bio,
    "I play doubles",
  );
});
