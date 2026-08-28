import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeSurveyQuestion } from "./surveyQuestionnaire";
import {
  eligibleLevelOptions,
  findLevelQuestion,
  levelIndex,
  levelNumber,
  levelOptions,
  nearLevelRange,
  rankableLevelOptions,
} from "./levelScope";

// The survey's own order is the ranking. Note "NTRP 4.5+" — a label arithmetic cannot
// produce or match — and "Prefer not to say", which has no position on the ladder.
const OPTIONS = [
  "NTRP 2.5",
  "NTRP 3.0",
  "NTRP 3.5",
  "NTRP 4.0",
  "NTRP 4.5",
  "NTRP 4.5+",
  "Prefer not to say",
];

test("finds the level question by its text", () => {
  const questions = [
    { id: 1, questionText: "Tell us about yourself", options: [] },
    { id: 2, questionText: "What is your NTRP level?", options: [{ optionText: "NTRP 4.0" }] },
  ].map((q) => normalizeSurveyQuestion(q as never));

  assert.equal(findLevelQuestion(questions)?.questionId, 2);
  assert.equal(findLevelQuestion([]), null);
  assert.equal(findLevelQuestion(null), null);
});

test("reads option labels in the survey's order, dropping blanks", () => {
  const question = normalizeSurveyQuestion({
    id: 2,
    questionText: "NTRP level",
    options: [{ optionText: "NTRP 3.0" }, { optionText: "  " }, { optionText: "NTRP 3.5" }],
  } as never);

  assert.deepEqual(levelOptions(question), ["NTRP 3.0", "NTRP 3.5"]);
  assert.deepEqual(levelOptions(null), []);
});

test("rankable options exclude labels with no position on the ladder", () => {
  assert.deepEqual(rankableLevelOptions(OPTIONS), [
    "NTRP 2.5",
    "NTRP 3.0",
    "NTRP 3.5",
    "NTRP 4.0",
    "NTRP 4.5",
    "NTRP 4.5+",
  ]);
});

test("levelIndex matches ignoring case and surrounding space", () => {
  assert.equal(levelIndex(OPTIONS, "NTRP 3.5"), 2);
  assert.equal(levelIndex(OPTIONS, "  ntrp 3.5  "), 2);
  assert.equal(levelIndex(OPTIONS, "NTRP 9.0"), -1);
  assert.equal(levelIndex(OPTIONS, null), -1);
  assert.equal(levelIndex(OPTIONS, ""), -1);
});

test("near range is the adjacent option either side", () => {
  assert.deepEqual(nearLevelRange(OPTIONS, "NTRP 3.5"), ["NTRP 3.0", "NTRP 3.5", "NTRP 4.0"]);
});

test("near range clamps at both ends rather than wrapping", () => {
  assert.deepEqual(nearLevelRange(OPTIONS, "NTRP 2.5"), ["NTRP 2.5", "NTRP 3.0"]);
  assert.deepEqual(nearLevelRange(OPTIONS, "NTRP 4.5+"), ["NTRP 4.5", "NTRP 4.5+"]);
});

test("near range never returns the unrankable option as a neighbour", () => {
  // The top rankable level's neighbour must not be "Prefer not to say", even though
  // it is literally the next entry in the survey's option list.
  assert.ok(!nearLevelRange(OPTIONS, "NTRP 4.5+").includes("Prefer not to say"));
});

test("a label arithmetic cannot handle still resolves by position", () => {
  // "NTRP 4.5+" ± 0.5 has no arithmetic answer; ordinal adjacency does.
  assert.deepEqual(nearLevelRange(OPTIONS, "NTRP 4.5"), ["NTRP 4.0", "NTRP 4.5", "NTRP 4.5+"]);
});

test("widening to two steps is the same operation with a bigger span", () => {
  assert.deepEqual(nearLevelRange(OPTIONS, "NTRP 3.5", 2), [
    "NTRP 2.5",
    "NTRP 3.0",
    "NTRP 3.5",
    "NTRP 4.0",
    "NTRP 4.5",
  ]);
});

test("no level, or an unplaceable one, means no scoping", () => {
  assert.deepEqual(nearLevelRange(OPTIONS, null), []);
  assert.deepEqual(nearLevelRange(OPTIONS, "Prefer not to say"), []);
  assert.deepEqual(nearLevelRange(OPTIONS, "Unknown"), []);
  assert.deepEqual(nearLevelRange([], "NTRP 4.0"), []);
});

test("eligibility is every rankable level", () => {
  assert.deepEqual(eligibleLevelOptions(OPTIONS), rankableLevelOptions(OPTIONS));
  assert.ok(!eligibleLevelOptions(OPTIONS).includes("Prefer not to say"));
});

test("levelNumber parses for display and gives up honestly", () => {
  assert.equal(levelNumber("NTRP 4.5"), 4.5);
  assert.equal(levelNumber("NTRP 4.5+"), 4.5);
  assert.equal(levelNumber("3"), 3);
  assert.equal(levelNumber("Unknown"), null);
  assert.equal(levelNumber(null), null);
});
