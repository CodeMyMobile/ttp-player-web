import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMatchProfileFromSurvey, sanitizeMatchProfile } from "./matchProfile";

// Regression: a missing level used to be silently defaulted to "3.0", which then
// reached other players in the intro SMS ("I'm a 3.0 player…"). Absent must stay absent.

test("sanitizeMatchProfile leaves a missing level null rather than inventing 3.0", () => {
  assert.equal(sanitizeMatchProfile({ about: "Hi" })?.level, null);
  assert.equal(sanitizeMatchProfile({ about: "Hi", level: "" })?.level, null);
  assert.equal(sanitizeMatchProfile({ about: "Hi", level: "   " })?.level, null);
  assert.equal(sanitizeMatchProfile({ about: "Hi", level: 4.5 as unknown as string })?.level, null);
});

test("sanitizeMatchProfile keeps a real level, trimmed", () => {
  assert.equal(sanitizeMatchProfile({ level: "4.5" })?.level, "4.5");
  assert.equal(sanitizeMatchProfile({ level: "  NTRP 4.5+  " })?.level, "NTRP 4.5+");
});

test("sanitizeMatchProfile returns null for a non-object", () => {
  assert.equal(sanitizeMatchProfile(null), null);
  assert.equal(sanitizeMatchProfile("4.5"), null);
});

test("buildMatchProfileFromSurvey does not invent a level when the question is unanswered", () => {
  const payload = {
    questions: [
      {
        id: 1,
        question_text: "Tell us about yourself",
        answers: [{ answer_text: "I play weekends" }],
      },
    ],
  };

  const profile = buildMatchProfileFromSurvey(payload, null);
  assert.notEqual(profile, null);
  assert.equal(profile?.level, null);
});

test("buildMatchProfileFromSurvey preserves a level already held in the fallback", () => {
  const fallback = sanitizeMatchProfile({ level: "4.0" });
  const payload = {
    questions: [
      {
        id: 1,
        question_text: "Tell us about yourself",
        answers: [{ answer_text: "I play weekends" }],
      },
    ],
  };

  assert.equal(buildMatchProfileFromSurvey(payload, fallback)?.level, "4.0");
});

test("buildMatchProfileFromSurvey returns the fallback untouched when there are no questions", () => {
  const fallback = sanitizeMatchProfile({ level: "3.5" });
  assert.equal(buildMatchProfileFromSurvey({ questions: [] }, fallback)?.level, "3.5");
  assert.equal(buildMatchProfileFromSurvey({ questions: [] }, null), null);
});
