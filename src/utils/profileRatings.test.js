import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCalculatedRating,
  formatLevelLabel,
  levelOptionsIncluding,
  normalizeProfileRating,
  resolveProfileLevel,
} from "./profileRatings.js";

test("normalizes backend calculated ratings for profile details", () => {
  assert.equal(normalizeProfileRating(4.25), "4.25");
  assert.equal(normalizeProfileRating("8.75"), "8.75");
  assert.equal(normalizeProfileRating(null), "");
  assert.equal(normalizeProfileRating(undefined), "");
});

test("formats missing calculated ratings as unavailable", () => {
  assert.equal(formatCalculatedRating("4.25"), "4.25");
  assert.equal(formatCalculatedRating(""), "Not available");
});

test("formats levels the way the dropdown writes them", () => {
  assert.equal(formatLevelLabel("3.500000"), "3.5");
  assert.equal(formatLevelLabel(4), "4.0");
  assert.equal(formatLevelLabel("3.75"), "3.75");
  assert.equal(formatLevelLabel(null), "");
  assert.equal(formatLevelLabel(0), "");
});

test("shows the rating quiz's estimate when nothing else is set", () => {
  assert.deepEqual(
    resolveProfileLevel({ usta_rating: null, self_rated_seed: "3.500000", matches_played: 0 }),
    { value: "3.5", source: "quiz" },
  );
});

test("prefers a declared rating, then a match rating, over the quiz estimate", () => {
  assert.deepEqual(
    resolveProfileLevel({ usta_rating: "4.0", self_rated_seed: "3.5" }),
    { value: "4.0", source: "declared" },
  );
  assert.deepEqual(
    resolveProfileLevel({ calculated_ntrp: 3.25, matches_played: 3, self_rated_seed: "3.5" }),
    { value: "3.25", source: "match" },
  );
});

test("ignores a calculated rating with no matches behind it", () => {
  assert.deepEqual(
    resolveProfileLevel({ calculated_ntrp: 3.25, matches_played: 0 }),
    { value: "", source: null },
  );
});

test("adds a shown level the dropdown doesn't offer, in order", () => {
  assert.deepEqual(levelOptionsIncluding(["3.0", "3.5"], "3.25"), ["3.0", "3.25", "3.5"]);
  assert.deepEqual(levelOptionsIncluding(["3.0", "3.5"], "3.5"), ["3.0", "3.5"]);
  assert.deepEqual(levelOptionsIncluding(["3.0", "3.5"], ""), ["3.0", "3.5"]);
});
