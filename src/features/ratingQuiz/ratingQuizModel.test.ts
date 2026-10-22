import assert from "node:assert/strict";
import test from "node:test";

import {
  POOL_SHIFT,
  RATING_MODEL_VERSION,
  activeQuestionIndex,
  activeRatingQuizQuestions,
  buildRatingQuizPayload,
  coefficients,
  declared,
  explain,
  nudgeTarget,
  ratingQuizQuestions,
  scoreRatingQuiz,
  settleEstimate,
  takeNudge,
  weights,
  type RatingQuizAnswers,
} from "./ratingQuizModel";

const optionsOf = (key: string) =>
  ratingQuizQuestions.find((question) => question.key === key)?.options.map((option) => option.id) ?? [];

// Answers that route rather than score: two exits from the background question.
const ROUTES = new Set(["starting", "usta"]);
const SCORED_BG = optionsOf("bg").filter((id) => !ROUTES.has(id));

/** Every estimated-path answer combination, for both pools. */
const everyEstimate = (): RatingQuizAnswers[] => {
  const all: RatingQuizAnswers[] = [];
  for (const pool of optionsOf("pool"))
    for (const bg of SCORED_BG)
      for (const freq of optionsOf("freq"))
        for (const serve of optionsOf("serve"))
          for (const rally of optionsOf("rally")) all.push({ pool, bg, freq, serve, rally });
  return all;
};

test("every scored answer in every combination has a weight", () => {
  // `weights[id] || 0` can't tell a deliberate zero from a missing entry. The rally
  // answers once had no entries and scored nothing, silently. Walk every combination
  // and check each answer the scorer will look up is really in the table.
  const combinations = everyEstimate();
  assert.equal(combinations.length, 2 * 4 * 4 * 4 * 4);

  for (const answers of combinations) {
    for (const key of Object.keys(coefficients) as Array<keyof typeof coefficients>) {
      const id = answers[key] as string;
      assert.ok(id in weights, `answer "${id}" on "${key}" has no weight; it would score zero silently`);
    }
    const { seed } = scoreRatingQuiz(answers);
    assert.ok(seed >= 2.5 && seed <= 5.0 && Number.isInteger(seed * 2), `seed ${seed} out of range`);
  }

  // And the reverse: every scored question is one the quiz asks, and every USTA
  // answer maps to a level.
  for (const key of Object.keys(coefficients)) {
    assert.ok(ratingQuizQuestions.some((question) => question.key === key), `coefficient "${key}" has no question`);
  }
  for (const id of optionsOf("usta")) assert.ok(id in declared, `declared rating "${id}" has no level`);
});

test("pins the recalibrated levels", () => {
  const seed = (bg: string, freq: string, serve: string, rally: string) =>
    scoreRatingQuiz({ pool: "m", bg, freq, serve, rally }).seed;

  assert.equal(seed("social", "f2", "s1", "r1"), 3.0);
  assert.equal(seed("lessons", "f2", "s1", "r2"), 3.5);
  assert.equal(seed("team", "f2", "s2", "r2"), 4.0);
  assert.equal(seed("college", "f3", "s3", "r3"), 5.0);
});

test("asks which pool first and no longer asks the comparison question", () => {
  assert.deepEqual(
    ratingQuizQuestions.map((question) => question.key),
    ["pool", "bg", "usta", "freq", "serve", "rally"],
  );
  assert.equal(JSON.stringify(ratingQuizQuestions).includes("Think of someone you play often"), false);
  assert.equal("cmp" in coefficients, false);
});

test("the pool adjustment ships inert, so it changes nobody's level yet", () => {
  assert.deepEqual(POOL_SHIFT, { m: 0, w: 0 });
  for (const answers of everyEstimate().filter((answers) => answers.pool === "m")) {
    assert.equal(scoreRatingQuiz(answers).seed, scoreRatingQuiz({ ...answers, pool: "w" }).seed);
  }
});

test("the scorer never reads the 'does that sound right?' feedback", () => {
  for (const feedback of ["low", "high", "right", "low_kept"]) {
    const answers = { pool: "w", bg: "lessons", freq: "f2", serve: "s1", rally: "r2" };
    assert.deepEqual(scoreRatingQuiz({ ...answers, feedback }), scoreRatingQuiz(answers));
  }
});

test("explains the four combinations of the two stroke answers", () => {
  const reasons = new Set(
    ["s0", "s3"].flatMap((serve) => ["r0", "r3"].map((rally) => explain({ serve, rally }))),
  );
  assert.equal(reasons.size, 4);
  assert.match(explain({ serve: "s2", rally: "r2" }), /you have both/);
});

test("the USTA question is only asked, and found by key, on the declared branch", () => {
  assert.equal(activeQuestionIndex({ bg: "lessons" }, "usta"), -1);
  assert.equal(activeQuestionIndex({ pool: "m", bg: "usta" }, "usta"), 2);
  assert.equal(activeRatingQuizQuestions({ bg: "usta" }).length, 6);
  assert.equal(activeRatingQuizQuestions({ bg: "lessons" }).length, 5);
});

test("a declared USTA rating writes only usta_rating and doesn't count questions", () => {
  assert.deepEqual(buildRatingQuizPayload({ pool: "m", bg: "usta", usta: "u45" }), { usta_rating: 4.5 });
  const result = scoreRatingQuiz({ bg: "usta", usta: "u50" });
  assert.equal(result.band, "5.0+");
  assert.equal(result.why, "You told us your USTA rating, which beats anything we could estimate.");
  assert.doesNotMatch(result.why, /five|questions/i);
});

test("the beginner answer is a level of its own", () => {
  const result = scoreRatingQuiz({ pool: "w", bg: "starting" });
  assert.equal(result.seed, 2);
  assert.equal(result.band, "1.5-2.0");
  assert.equal(result.confidence, "Starting out");
  assert.equal(result.beginner, true);
});

test("an estimate saves as the quiz's own, stamped with the shared model version", () => {
  const answers = { pool: "m", bg: "lessons", freq: "f2", serve: "s2", rally: "r2" };
  assert.equal(RATING_MODEL_VERSION, 3);
  assert.deepEqual(buildRatingQuizPayload(answers), {
    self_rated_seed: 3.5,
    self_rating_source: "self_assessed",
    rating_quiz_answers: answers,
    rating_model_version: 3,
  });
});

test("taking the half step saves the player's own claim, as the API names it", () => {
  const answers = { pool: "m", bg: "lessons", freq: "f2", serve: "s2", rally: "r2", feedback: "low" };
  const estimate = settleEstimate(scoreRatingQuiz(answers));
  const target = nudgeTarget(estimate.seed, answers.feedback);
  assert.equal(target, 4);

  const payload = buildRatingQuizPayload(answers, takeNudge(target as number));
  assert.deepEqual(payload, {
    self_rated_seed: 4,
    self_rating_source: "player",
    rating_quiz_answers: answers,
    rating_model_version: 3,
  });
});

test("only offers a half step the API can save", () => {
  assert.equal(nudgeTarget(3.5, "low"), 4);
  assert.equal(nudgeTarget(3.5, "high"), 3);
  assert.equal(nudgeTarget(2, "high"), 1.5);
  // From 5.0 there is no step up the API accepts (it used to offer 5.5).
  assert.equal(nudgeTarget(5, "low"), null);
  assert.equal(nudgeTarget(1.5, "high"), null);
  assert.equal(nudgeTarget(3.5, "right"), null);
  assert.equal(nudgeTarget(3.5, undefined), null);
});
