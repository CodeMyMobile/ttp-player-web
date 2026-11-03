import assert from "node:assert/strict";
import { test } from "node:test";

import { isMeaningfulBio, levelEvidenceLabel, levelFilterBucket, mapSuggestedPlayer } from "./suggestedPlayer";

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

test("the mapper accepts the privacy-safe courts field", () => {
  assert.equal(
    mapSuggestedPlayer({ userId: 1, full_name: "A B", courts: ["Central Courts"] }).favoriteCourt,
    "Central Courts",
  );
});

test("a level from match results comes before the self-rated one", () => {
  const player = mapSuggestedPlayer({ userId: 1, skillLevel: "NTRP 3.5", resultsNtrp: 3.75 });
  assert.equal(player.level, "3.75");
  assert.equal(player.levelSource, "results");
  assert.equal(mapSuggestedPlayer({ userId: 2, skillLevel: "NTRP 3.5", resultsNtrp: "4" }).level, "4.0");
});

test("without results the survey level shows, marked self-rated", () => {
  const player = mapSuggestedPlayer({ userId: 1, skillLevel: "NTRP 3.5", resultsNtrp: null });
  assert.equal(player.level, "3.5");
  assert.equal(player.levelSource, "self");
  const none = mapSuggestedPlayer({ userId: 2 });
  assert.equal(none.level, "Unknown");
  assert.equal(none.levelSource, null);
});

test("a quarter level is filtered under the half level below it", () => {
  assert.equal(levelFilterBucket("3.75"), "3.5");
  assert.equal(levelFilterBucket("4.0"), "4.0");
  assert.equal(levelFilterBucket("4.5+"), "4.5");
  assert.equal(levelFilterBucket("Unknown"), null);
});

test("each level says how it is known, results first", () => {
  const results = mapSuggestedPlayer({
    userId: 1,
    skillLevel: "NTRP 3.5",
    resultsNtrp: 3.75,
    resultsMatchesPlayed: 12,
    isLevelConfirmed: true,
    verifiedLevelCount: 4,
  });
  assert.equal(results.levelSource, "results");
  assert.equal(levelEvidenceLabel(results), "12 matches");
  assert.equal(levelEvidenceLabel({ ...results, resultsMatches: 1 }), "1 match");

  const vouched = mapSuggestedPlayer({ userId: 2, skillLevel: "NTRP 3.5", isLevelConfirmed: true, verifiedLevelCount: "4" });
  assert.equal(vouched.levelSource, "vouched");
  assert.equal(levelEvidenceLabel(vouched), "Vouched by 4");

  // Two vouches are under the bar, so the level is still only what they told us.
  const fewVouches = mapSuggestedPlayer({ userId: 3, skillLevel: "NTRP 3.5", isLevelConfirmed: false, verifiedLevelCount: 2 });
  assert.equal(levelEvidenceLabel(fewVouches), "Self-rated");

  assert.equal(levelEvidenceLabel(mapSuggestedPlayer({ userId: 4 })), null);
});
