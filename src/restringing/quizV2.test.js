import assert from "node:assert/strict";
import test from "node:test";

import { levelFromNtrp, QUIZ_QUESTIONS } from "./quizV2.js";

// The recommendation itself is the API's (stringRecommendations.js in ttp-api, tested
// there); these are the questions it expects, in the values it accepts.
test("five questions, level first, in the engine's values", () => {
  assert.deepEqual(QUIZ_QUESTIONS.map((q) => q.key), ["level", "arm", "priority", "frequency", "breakage"]);
  assert.deepEqual(QUIZ_QUESTIONS[0].options.map((o) => o.value), ["getting_started", "intermediate", "advanced", "competitive"]);
  assert.deepEqual(QUIZ_QUESTIONS[1].options.map((o) => o.value), ["no", "sometimes", "yes"]);
  assert.deepEqual(QUIZ_QUESTIONS[2].options.map((o) => o.value), ["spin", "control", "power", "comfort"]);
  assert.deepEqual(QUIZ_QUESTIONS[3].options.map((o) => o.value), ["weekly", "few", "most_days"]);
  assert.deepEqual(QUIZ_QUESTIONS[4].options.map((o) => o.value), ["rarely", "sometimes", "often"]);
});

test("NTRP pre-selects a level; Competitive is never assumed", () => {
  assert.equal(levelFromNtrp(2.5), "getting_started");
  assert.equal(levelFromNtrp(3.0), "getting_started");
  assert.equal(levelFromNtrp(3.5), "intermediate");
  assert.equal(levelFromNtrp(4.25), "intermediate");
  assert.equal(levelFromNtrp(4.5), "advanced");
  assert.equal(levelFromNtrp(6.5), "advanced");
  assert.equal(levelFromNtrp(null), null);
  assert.equal(levelFromNtrp(0), null);
});
