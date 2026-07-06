import assert from "node:assert/strict";
import test from "node:test";

import { formatCalculatedRating, normalizeProfileRating } from "./profileRatings.js";

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
