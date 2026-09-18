import assert from "node:assert/strict";
import test from "node:test";

import { makeMatchProfileEditSurveyQuestions } from "./surveyQuestionnaire";

test("makeMatchProfileEditSurveyQuestions makes image upload optional without changing other required questions", () => {
  const questions = makeMatchProfileEditSurveyQuestions([
    {
      questionId: "13",
      questionType: "TextArea",
      questionText: "Tell us more about yourself",
      answerRequired: true,
      options: [],
    },
    {
      questionId: "14",
      questionType: "ImageUpload",
      questionText: "Upload your profile picture",
      answerRequired: true,
      options: [],
    },
  ]);

  assert.equal(questions[0].answerRequired, true);
  assert.equal(questions[1].answerRequired, false);
});
