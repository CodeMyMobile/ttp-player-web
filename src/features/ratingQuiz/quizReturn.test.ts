import assert from "node:assert/strict";
import test from "node:test";

import { quizReturnPath } from "./quizReturn";

test("the quiz opened from home goes back to home", () => {
  assert.equal(quizReturnPath("?from=home"), "/");
  assert.equal(quizReturnPath("?x=1&from=home"), "/");
});

test("any other way into the quiz stays on the result screen", () => {
  assert.equal(quizReturnPath(""), null);
  assert.equal(quizReturnPath("?from=profile"), null);
  assert.equal(quizReturnPath("?from=https://evil.example"), null);
});
