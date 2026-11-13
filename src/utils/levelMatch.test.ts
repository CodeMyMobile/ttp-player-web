import assert from "node:assert/strict";
import test from "node:test";

import { levelMatch, levelMatchLabel, shownLevel } from "./levelMatch";

test("a 4.0 class is near, not at, a 4.5 player's level", () => {
  assert.equal(levelMatch({ min: 4, max: 4 }, 4.5), "near");
  assert.equal(levelMatchLabel(levelMatch({ min: 4, max: 4 }, 4.5)), "Near your level");
});

test("at your level only when the player's level is inside the band", () => {
  assert.equal(levelMatch({ min: 4.5, max: 4.5 }, 4.5), "exact");
  assert.equal(levelMatch({ min: 3.5, max: 4 }, 3.5), "exact");
  assert.equal(levelMatch({ min: 3.5, max: 4 }, 4), "exact");
  assert.equal(levelMatchLabel("exact"), "At your level");
});

test("compares at the level the player is shown, the nearest half", () => {
  assert.equal(shownLevel(4.6), 4.5);
  assert.equal(shownLevel("4.3"), 4.5);
  assert.equal(levelMatch({ min: 4.5, max: 4.5 }, 4.6), "exact");
});

test("near within half a level either side, nothing further", () => {
  assert.equal(levelMatch({ min: 3.5, max: 4 }, 4.5), "near");
  assert.equal(levelMatch({ min: 4.5, max: 4.5 }, 4), "near");
  assert.equal(levelMatch({ min: 3.5, max: 3.5 }, 4.5), null);
  assert.equal(levelMatch({ min: 4.5, max: 4.5 }, 3.5), null);
  assert.equal(levelMatchLabel(null), null);
});

test("a 3.5+ class is a 3.5 class that a 4.0 is near", () => {
  assert.equal(levelMatch({ min: 3.5, max: null }, 3.5), "exact");
  assert.equal(levelMatch({ min: 3.5, max: null }, 4), "near");
  assert.equal(levelMatch({ min: 3.5, max: null }, 4.5), null);
});

test("claims nothing when either level is unknown", () => {
  assert.equal(levelMatch(null, 4.5), null);
  assert.equal(levelMatch({ min: 4, max: 4 }, null), null);
  assert.equal(levelMatch({ min: 4, max: 4 }, ""), null);
});
