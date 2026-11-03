import assert from "node:assert/strict";
import test from "node:test";

import { quizHrefFromMatch, quizReturnPath } from "./quizReturn";

test("the quiz opened from home goes back to home", () => {
  assert.equal(quizReturnPath("?from=home"), "/");
  assert.equal(quizReturnPath("?x=1&from=home"), "/");
});

test("any other way into the quiz stays on the result screen", () => {
  assert.equal(quizReturnPath(""), null);
  assert.equal(quizReturnPath("?from=profile"), null);
  assert.equal(quizReturnPath("?from=https://evil.example"), null);
});

test("the quiz opened from a match goes back to that match", () => {
  assert.equal(quizReturnPath("?from=match-478"), "/matches/478");
  assert.equal(quizHrefFromMatch(478), "/rating-quiz?from=match-478");
});

test("a match return that isn't a plain id is ignored", () => {
  assert.equal(quizReturnPath("?from=match-478/../../x"), null);
  assert.equal(quizReturnPath("?from=match-"), null);
  assert.equal(quizHrefFromMatch("abc"), "/rating-quiz");
});
