import assert from "node:assert/strict";
import test from "node:test";

import { resolveStatusTiles } from "./homeTiles";

test("unrated with bookings shows the count beside the get-rated prompt", () => {
  // The case that was broken: a standing weekly lesson, no match history.
  assert.deepEqual(resolveStatusTiles({ ratingState: "unrated", bookingsCount: 3 }), {
    left: "getRated",
    right: "bookings",
    fullWidth: false,
  });
});

test("unrated with nothing booked gives the prompt the full row", () => {
  assert.deepEqual(resolveStatusTiles({ ratingState: "unrated", bookingsCount: 0 }), {
    left: "getRated",
    right: null,
    fullWidth: true,
  });
});

test("rated with bookings is unchanged", () => {
  assert.deepEqual(resolveStatusTiles({ ratingState: "rated", bookingsCount: 3 }), {
    left: "rating",
    right: "bookings",
    fullWidth: false,
  });
});

test("rated with nothing booked is unchanged", () => {
  assert.deepEqual(resolveStatusTiles({ ratingState: "rated", bookingsCount: 0 }), {
    left: "rating",
    right: "playFirst",
    fullWidth: false,
  });
});

test("the rating tile is gated on rating; the bookings tile never is", () => {
  for (const bookingsCount of [0, 1, 9]) {
    assert.equal(resolveStatusTiles({ ratingState: "unrated", bookingsCount }).left, "getRated");
    assert.equal(resolveStatusTiles({ ratingState: "rated", bookingsCount }).left, "rating");
  }
  // Bookings show whenever they exist, rated or not.
  assert.equal(resolveStatusTiles({ ratingState: "unrated", bookingsCount: 1 }).right, "bookings");
  assert.equal(resolveStatusTiles({ ratingState: "rated", bookingsCount: 1 }).right, "bookings");
});

/**
 * The reported bug: Adam Luftig, 13 matches, rank 23, current_rating 6.4, was
 * shown "Play a match to get rated". The server said ranked; the client had not
 * heard yet, and `Boolean(undefined)` reads the same as "not rated".
 */
test("unknown never renders the get-rated prompt", () => {
  for (const bookingsCount of [0, 1, 9]) {
    const { left } = resolveStatusTiles({ ratingState: "unknown", bookingsCount });
    assert.equal(left, "ratingUnknown");
    assert.notEqual(left, "getRated");
  }
});

test("unknown makes no claim about matches played either", () => {
  // "Play your first match" is as wrong for a rank-23 player as "get rated" is.
  assert.deepEqual(resolveStatusTiles({ ratingState: "unknown", bookingsCount: 0 }), {
    left: "ratingUnknown",
    right: null,
    fullWidth: false,
  });
});

test("unknown still shows bookings, which do not depend on the rating", () => {
  assert.deepEqual(resolveStatusTiles({ ratingState: "unknown", bookingsCount: 2 }), {
    left: "ratingUnknown",
    right: "bookings",
    fullWidth: false,
  });
});

test("unknown never takes the full row, so the layout does not jump when it resolves", () => {
  for (const bookingsCount of [0, 3]) {
    assert.equal(resolveStatusTiles({ ratingState: "unknown", bookingsCount }).fullWidth, false);
  }
});
