import assert from "node:assert/strict";
import test from "node:test";

import {
  isRatedInRankings,
  ladderPositionLabel,
  ordinal,
  rankedPosition,
} from "./matchResults";

// The API sorts rows by distance when geo params are supplied and only then
// assigns rank = index + 1, so the array order below is deliberately NOT
// rating order — that is the whole point of these tests.
const NEARBY_ORDER = [
  { user_id: 1, current_rating: 5.1, rank: 1 },
  { user_id: 2, current_rating: 6.4, rank: 2 },
  { user_id: 3, current_rating: 5.9, rank: 3 },
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
    { user_id: 1, current_rating: null },
    { user_id: 2, current_rating: 6.4 },
    { user_id: 3, current_rating: 5.9 },
  ];

  assert.equal(rankedPosition(rows, 2), 1);
  assert.equal(rankedPosition(rows, 3), 2);
  assert.equal(rankedPosition(rows, 1), null);
});

test("string ratings are compared numerically", () => {
  const rows = [
    { user_id: 1, current_rating: "5.90" },
    { user_id: 2, current_rating: "6.40" },
  ];

  assert.equal(rankedPosition(rows, 2), 1);
});

test("ties keep the order the API returned, so position is stable", () => {
  const rows = [
    { user_id: 1, current_rating: 6.0 },
    { user_id: 2, current_rating: 6.0 },
  ];

  assert.equal(rankedPosition(rows, 1), 1);
  assert.equal(rankedPosition(rows, 2), 2);
});

test("the rated gate is presence of a rated row, not survey completion", () => {
  assert.equal(isRatedInRankings(NEARBY_ORDER, 2), true);
  assert.equal(isRatedInRankings(NEARBY_ORDER, 99), false);
  assert.equal(isRatedInRankings([{ user_id: 5, current_rating: null }], 5), false);
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
