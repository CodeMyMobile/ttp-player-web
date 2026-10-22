import assert from "node:assert/strict";
import { test } from "node:test";

import { APP_SAVE_LEVEL_URL, loginHref, saveLevelHref } from "../src/lib/appLinks.ts";

test("hands the quiz result to the app's save-level route", () => {
  const quiz = JSON.stringify({
    self_rated_seed: 3.5,
    self_rating_source: "self_assessed",
    rating_quiz_answers: { bg: "lessons", serve: "s2" },
    rating_model_version: 2,
  });

  // The app's quizHandoff.test.ts parses this exact string; keep the two in step.
  assert.equal(
    saveLevelHref(quiz),
    "https://app.thetennisplan.com/#/save-level?quiz=%7B%22self_rated_seed%22%3A3.5%2C%22self_rating_source%22%3A%22self_assessed%22%2C%22rating_quiz_answers%22%3A%7B%22bg%22%3A%22lessons%22%2C%22serve%22%3A%22s2%22%7D%2C%22rating_model_version%22%3A2%7D",
  );
  assert.ok(saveLevelHref(quiz).startsWith(APP_SAVE_LEVEL_URL));
});

test("without a quiz result it is a plain sign-in that lands on the app home", () => {
  assert.equal(saveLevelHref(null), loginHref());
  assert.equal(saveLevelHref(""), "https://app.thetennisplan.com/#/login");
});
