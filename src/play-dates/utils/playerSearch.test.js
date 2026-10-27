import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPlayersByName,
  getPlayerSearchId,
  getPlayerSearchName,
  getPlayerSearchRating,
} from "./playerSearch.js";

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

test("filterPlayersByName matches every typed word, in any order, ignoring case and accents", () => {
  const players = [
    { id: 1, full_name: "Paul Cochrane" },
    { id: 2, full_name: "José Alvarez" },
    { id: 3, full_name: "Paula Smith" },
  ];
  const ids = (query) => filterPlayersByName(players, query).map((player) => player.id);

  assert.deepEqual(ids(""), [1, 2, 3]);
  assert.deepEqual(ids("   "), [1, 2, 3]);
  assert.deepEqual(ids("paul"), [1, 3]);
  assert.deepEqual(ids("COCH paul"), [1]);
  assert.deepEqual(ids("jose"), [2]);
  assert.deepEqual(ids("zzz"), []);
});
