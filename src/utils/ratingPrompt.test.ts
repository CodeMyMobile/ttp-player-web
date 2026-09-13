import assert from "node:assert/strict";
import test from "node:test";

import { declaredLevelOf, ratingPrompt } from "./ratingPrompt";

test("a player with no declared level is asked to find one", () => {
  const prompt = ratingPrompt(null);
  assert.equal(prompt.title, "Find your tennis level");
  assert.equal(prompt.href, "/rating-quiz");
});

/**
 * The case this exists for: a profile says 4.5, the ladder says unranked, and
 * the tile used to tell them to go and find the level they had already given.
 */
test("a player with a declared level is asked to confirm it, not find it", () => {
  const prompt = ratingPrompt(4.5);
  assert.equal(prompt.title, "Confirm your 4.5");
  assert.equal(prompt.sub, "Play a rated match to join the ladder");
  assert.equal(prompt.href, "/matches");
  assert.doesNotMatch(prompt.title, /find/i);
});

test("whole levels keep one decimal, as the profile writes them", () => {
  assert.equal(ratingPrompt(4).title, "Confirm your 4.0");
  assert.equal(ratingPrompt(3.5).title, "Confirm your 3.5");
});

test("a declared USTA rating wins over a quiz estimate", () => {
  assert.equal(declaredLevelOf({ usta_rating: 4.5, self_rated_seed: 3.5 }), 4.5);
  assert.equal(declaredLevelOf({ self_rated_seed: 3.5 }), 3.5);
  assert.equal(declaredLevelOf({ usta_rating: "4.5" }), 4.5);
});

/**
 * recomputeRatings() writes a rating for every profile, so zeros are common and
 * mean "nobody said this". Echoing one back as "Confirm your 0.0" would be worse
 * than the prompt it replaces.
 */
test("a zero or empty level is not a declared level", () => {
  assert.equal(declaredLevelOf({ usta_rating: 0 }), null);
  assert.equal(declaredLevelOf({ usta_rating: "" }), null);
  assert.equal(declaredLevelOf({ usta_rating: null, self_rated_seed: null }), null);
  assert.equal(declaredLevelOf(null), null);
  assert.equal(declaredLevelOf(undefined), null);
  assert.equal(declaredLevelOf({ usta_rating: "not a number" }), null);
});

test("a zero usta_rating still falls through to a real seed", () => {
  assert.equal(declaredLevelOf({ usta_rating: 0, self_rated_seed: 3 }), 3);
});
