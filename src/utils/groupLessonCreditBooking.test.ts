import assert from "node:assert/strict";
import test from "node:test";

import { buildGroupLessonCreditConsumeParams } from "./groupLessonCreditBooking";

test("buildGroupLessonCreditConsumeParams does not require a participant id", () => {
  assert.deepEqual(
    buildGroupLessonCreditConsumeParams({
      token: "token-123",
      coachId: 26,
      lessonId: 2670,
      purchaseId: 52,
      participantId: undefined,
    }),
    {
      token: "token-123",
      coachId: 26,
      lessonType: "group",
      lessonId: 2670,
      purchaseId: 52,
    },
  );
});
