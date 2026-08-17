import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPlayed,
  isRatedInRankings,
  ladderPositionLabel,
  ordinal,
  rankedPosition,
} from "./matchResults";

// The API sorts rows by distance when geo params are supplied and only then
// assigns rank = index + 1, so the array order below is deliberately NOT
// rating order — that is the whole point of these tests.
const NEARBY_ORDER = [
  { user_id: 1, current_rating: 5.1, matches_played: 4, rank: 1 },
  { user_id: 2, current_rating: 6.4, matches_played: 9, rank: 2 },
  { user_id: 3, current_rating: 5.9, matches_played: 6, rank: 3 },
];

test("position comes from rating order, not the array order the API returns", () => {
  assert.equal(rankedPosition(NEARBY_ORDER, 2), 1);
  assert.equal(rankedPosition(NEARBY_ORDER, 3), 2);
  assert.equal(rankedPosition(NEARBY_ORDER, 1), 3);
});

test("the API's own rank field disagrees, which is why it is unused", () => {
  const viewer = NEARBY_ORDER.find((row) => row.user_id === 2);

  assert.equal(viewer?.rank, 2);
  assert.equal(rankedPosition(NEARBY_ORDER, 2), 1);
});

test("a player not in the list has no position", () => {
  assert.equal(rankedPosition(NEARBY_ORDER, 99), null);
  assert.equal(rankedPosition([], 1), null);
  assert.equal(rankedPosition(NEARBY_ORDER, null), null);
});

test("unrated rows are excluded from the ordering", () => {
  const rows = [
    { user_id: 1, current_rating: null, matches_played: 2 },
    { user_id: 2, current_rating: 6.4, matches_played: 9 },
    { user_id: 3, current_rating: 5.9, matches_played: 6 },
  ];

  assert.equal(rankedPosition(rows, 2), 1);
  assert.equal(rankedPosition(rows, 3), 2);
  assert.equal(rankedPosition(rows, 1), null);
});

test("string ratings are compared numerically", () => {
  const rows = [
    { user_id: 1, current_rating: "5.90", matches_played: 3 },
    { user_id: 2, current_rating: "6.40", matches_played: 3 },
  ];

  assert.equal(rankedPosition(rows, 2), 1);
});

test("ties keep the order the API returned, so position is stable", () => {
  const rows = [
    { user_id: 1, current_rating: 6.0, matches_played: 3 },
    { user_id: 2, current_rating: 6.0, matches_played: 3 },
  ];

  assert.equal(rankedPosition(rows, 1), 1);
  assert.equal(rankedPosition(rows, 2), 2);
});

test("the rated gate is having played, not merely having a rating row", () => {
  assert.equal(isRatedInRankings(NEARBY_ORDER, 2), true);
  assert.equal(isRatedInRankings(NEARBY_ORDER, 99), false);
});

// The shape production is overwhelmingly full of: recomputeRatings() writes
// current_rating for every profile, so 1134 of 1203 rows look like this. The
// previous gate read them as rated and would have shown each of them "0.0".
test("a zero-rated row with no matches is NOT rated", () => {
  const seeded = [{ user_id: 5, current_rating: 0, matches_played: 0 }];

  assert.equal(isRatedInRankings(seeded, 5), false);
  assert.equal(rankedPosition(seeded, 5), null);
  assert.equal(hasPlayed(seeded[0]), false);
});

test("a zero rating with matches played is rated, and does not crash", () => {
  const rows = [{ user_id: 5, current_rating: 0, matches_played: 3 }];

  assert.equal(isRatedInRankings(rows, 5), true);
  assert.equal(rankedPosition(rows, 5), 1);
});

test("a player absent from the rankings is not rated", () => {
  assert.equal(isRatedInRankings(NEARBY_ORDER, 12345), false);
  assert.equal(isRatedInRankings([], 1), false);
  assert.equal(rankedPosition([], 1), null);
});

test("seeded rows do not dilute a real player's position", () => {
  // A real player among a crowd of zero-rated profiles is still first.
  const rows = [
    { user_id: 1, current_rating: 0, matches_played: 0 },
    { user_id: 2, current_rating: 0, matches_played: 0 },
    { user_id: 3, current_rating: 6.4, matches_played: 7 },
  ];

  assert.equal(rankedPosition(rows, 3), 1);
});

test("ordinals read correctly, including the teens", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
  ]);
});

test("the tile says nearby, never a club name", () => {
  assert.equal(ladderPositionLabel(3), "3rd nearby");
  assert.equal(ladderPositionLabel(12), "12th nearby");
  assert.equal(ladderPositionLabel(null), null);
});
