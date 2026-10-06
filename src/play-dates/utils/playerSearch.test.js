import assert from "node:assert/strict";
import test from "node:test";

import { getPlayerSearchId, getPlayerSearchName, getPlayerSearchRating } from "./playerSearch.js";

test("player search accepts either id field", () => {
  assert.equal(getPlayerSearchId({ id: 42 }), 42);
  assert.equal(getPlayerSearchId({ user_id: 43 }), 43);
});

test("player search never uses email as a display-name fallback", () => {
  assert.equal(
    getPlayerSearchName({ id: 42, email: "player@example.com" }),
    "Player 42",
  );
});

test("player search uses secure API rating fields before legacy aliases", () => {
  assert.equal(
    getPlayerSearchRating({ usta_rating: "3.5", ntrp: "2.5" }),
    "3.5",
  );
  assert.equal(getPlayerSearchRating({ uta_rating: "7.2" }), "7.2");
});
