import assert from "node:assert/strict";
import test from "node:test";

import { activeRatingQuizQuestions, buildRatingQuizPayload, scoreRatingQuiz } from "./ratingQuizModel";

test("normal estimate returns seed payload with raw answers", () => {
  const answers = {
    bg: "lessons",
    freq: "f2",
    serve: "s2",
    rally: "r2",
    cmp: "c_split",
  };

  assert.deepEqual(buildRatingQuizPayload(answers), {
    self_rated_seed: 4,
    self_rating_source: "self_assessed",
    rating_quiz_answers: answers,
    rating_model_version: 2,
  });
});

test("declared branch writes only usta_rating", () => {
  assert.deepEqual(buildRatingQuizPayload({ bg: "usta", usta: "u45" }), {
    usta_rating: 4.5,
  });
});

test("usta question only appears on declared branch", () => {
  assert.equal(activeRatingQuizQuestions({ bg: "lessons" }).some((question) => question.key === "usta"), false);
  assert.equal(activeRatingQuizQuestions({ bg: "usta" }).some((question) => question.key === "usta"), true);
});

test("starting path returns a beginner estimate immediately", () => {
  const result = scoreRatingQuiz({ bg: "starting" });

  assert.equal(result.seed, 2);
  assert.equal(result.band, "1.5-2.0");
  assert.equal(result.confidence, "Starting out");
});
