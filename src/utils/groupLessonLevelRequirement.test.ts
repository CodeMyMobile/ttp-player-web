import assert from "node:assert/strict";
import test from "node:test";

import {
  levelRequirementOf,
  levelRequirementTitle,
  meetsLevelRequirement,
} from "./groupLessonLevelRequirement";

test("reads the level a coach typed into the class label", () => {
  assert.equal(levelRequirementOf({ level: 4.5 }), 4.5);
  assert.equal(levelRequirementOf({ level: null, skillLabel: "Advanced Plus (NTRP 4.5)" }), 4.5);
  assert.equal(levelRequirementOf({ level: null, skillLabel: "Intermediate (NTRP 3.5)" }), 3.5);
});

/**
 * No notice is better than a guessed one. These are real production labels: a
 * class with no level, and one whose level lives in the title instead.
 */
test("classes with no stated level get no notice", () => {
  assert.equal(levelRequirementOf({ level: null, skillLabel: "" }), null);
  assert.equal(levelRequirementOf({ level: null, skillLabel: null }), null);
  assert.equal(levelRequirementOf({}), null);
});

test("the title reads as a floor, because that is what the copy promises", () => {
  assert.equal(levelRequirementTitle(4.5), "USTA 4.5+ required");
  assert.equal(levelRequirementTitle(4), "USTA 4.0+ required");
});

test("a level at or above the requirement clears it", () => {
  assert.equal(meetsLevelRequirement(4.5, 4.5), true);
  assert.equal(meetsLevelRequirement(5, 4.5), true);
  assert.equal(meetsLevelRequirement(4, 4.5), false);
});

test("an unknown level does not clear a requirement, and no requirement clears anything", () => {
  assert.equal(meetsLevelRequirement(null, 4.5), false);
  assert.equal(meetsLevelRequirement(undefined, 4.5), false);
  assert.equal(meetsLevelRequirement(null, null), true);
  assert.equal(meetsLevelRequirement(3, null), true);
});
