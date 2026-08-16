import assert from "node:assert/strict";
import test from "node:test";

import { resolveStatusTiles } from "./homeTiles";

test("unrated with bookings shows the count beside the get-rated prompt", () => {
  // The case that was broken: a standing weekly lesson, no match history.
  assert.deepEqual(resolveStatusTiles({ isRated: false, bookingsCount: 3 }), {
    left: "getRated",
    right: "bookings",
    fullWidth: false,
  });
});

test("unrated with nothing booked gives the prompt the full row", () => {
  assert.deepEqual(resolveStatusTiles({ isRated: false, bookingsCount: 0 }), {
    left: "getRated",
    right: null,
    fullWidth: true,
  });
});

test("rated with bookings is unchanged", () => {
  assert.deepEqual(resolveStatusTiles({ isRated: true, bookingsCount: 3 }), {
    left: "rating",
    right: "bookings",
    fullWidth: false,
  });
});

test("rated with nothing booked is unchanged", () => {
  assert.deepEqual(resolveStatusTiles({ isRated: true, bookingsCount: 0 }), {
    left: "rating",
    right: "playFirst",
    fullWidth: false,
  });
});

test("the rating tile is gated on rating; the bookings tile never is", () => {
  for (const bookingsCount of [0, 1, 9]) {
    assert.equal(resolveStatusTiles({ isRated: false, bookingsCount }).left, "getRated");
    assert.equal(resolveStatusTiles({ isRated: true, bookingsCount }).left, "rating");
  }
  // Bookings show whenever they exist, rated or not.
  assert.equal(resolveStatusTiles({ isRated: false, bookingsCount: 1 }).right, "bookings");
  assert.equal(resolveStatusTiles({ isRated: true, bookingsCount: 1 }).right, "bookings");
});
