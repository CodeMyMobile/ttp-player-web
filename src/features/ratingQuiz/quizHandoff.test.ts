import assert from "node:assert/strict";
import test from "node:test";

import { parseQuizHandoff } from "./quizHandoff";
import { hasStoredRating } from "./storedRating";

const search = (payload: unknown) => `?quiz=${encodeURIComponent(JSON.stringify(payload))}`;

// The exact string the public site's saveLevelHref builds for a 3.5 estimate
// (apps/public-site/tests/appLinks.test.mjs pins the same value from the other side).
const PUBLIC_SITE_EXAMPLE =
  "?quiz=%7B%22self_rated_seed%22%3A3.5%2C%22self_rating_source%22%3A%22self_assessed%22%2C%22rating_quiz_answers%22%3A%7B%22bg%22%3A%22lessons%22%2C%22serve%22%3A%22s2%22%7D%2C%22rating_model_version%22%3A2%7D";

test("reads the public site's handoff as the body the API takes", () => {
  assert.deepEqual(parseQuizHandoff(PUBLIC_SITE_EXAMPLE), {
    self_rated_seed: 3.5,
    self_rating_source: "self_assessed",
    rating_quiz_answers: { bg: "lessons", serve: "s2" },
    rating_model_version: 2,
  });
});

test("keeps a level the player nudged themselves as their own claim", () => {
  // The shared model (v3) sends "player"; links from before it said "self_declared".
  for (const source of ["player", "self_declared"]) {
    const payload = parseQuizHandoff(search({ self_rated_seed: 4, self_rating_source: source }));
    assert.equal(payload?.self_rating_source, "player");
  }
});

test("passes the shared model's version through", () => {
  assert.equal(parseQuizHandoff(search({ self_rated_seed: 3, rating_model_version: 3 }))?.rating_model_version, 3);
});

test("passes a declared USTA rating through on its own", () => {
  assert.deepEqual(parseQuizHandoff(search({ usta_rating: 4.5, self_rated_seed: 3 })), { usta_rating: 4.5 });
});

test("rejects levels the API would refuse", () => {
  assert.equal(parseQuizHandoff(search({ self_rated_seed: 5.5 })), null);
  assert.equal(parseQuizHandoff(search({ self_rated_seed: 3.25 })), null);
  assert.equal(parseQuizHandoff(search({ self_rated_seed: 1 })), null);
  assert.equal(parseQuizHandoff(search({ usta_rating: 3.3 })), null);
});

test("rejects anything that isn't a quiz result", () => {
  assert.equal(parseQuizHandoff(""), null);
  assert.equal(parseQuizHandoff("?quiz=not-json"), null);
  assert.equal(parseQuizHandoff(search([3.5])), null);
  assert.equal(parseQuizHandoff(search({ full_name: "Someone else" })), null);
});

test("keeps only the fields it knows and drops malformed answers", () => {
  const payload = parseQuizHandoff(
    search({
      self_rated_seed: 3,
      self_rating_source: "coach",
      full_name: "Injected",
      rating_quiz_answers: { bg: "lessons", odd: { nested: true }, long: "x".repeat(100) },
      rating_model_version: "two",
    }),
  );
  assert.deepEqual(payload, {
    self_rated_seed: 3,
    self_rating_source: "self_assessed",
    rating_quiz_answers: { bg: "lessons" },
  });
});

test("treats any existing level as one the quiz must not replace", () => {
  assert.equal(hasStoredRating(null), false);
  assert.equal(hasStoredRating({ usta_rating: null, self_rated_seed: null, matches_played: 0 }), false);
  assert.equal(hasStoredRating({ self_rated_seed: "3.500000" }), true);
  assert.equal(hasStoredRating({ usta_rating: "4.0" }), true);
  assert.equal(hasStoredRating({ current_rating: 6.2, matches_played: 3 }), true);
  assert.equal(hasStoredRating({ current_rating: 6.2, matches_played: 0 }), false);
});
