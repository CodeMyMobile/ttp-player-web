import assert from "node:assert/strict";
import test from "node:test";

import {
  LESSON_UNAVAILABLE_TO_BOOK_MESSAGE,
  getLessonAvailabilityErrorMessage,
  isCoachBlockedPlayerError,
} from "./lessonAvailabilityError";

test("isCoachBlockedPlayerError matches API code", () => {
  assert.equal(isCoachBlockedPlayerError({ data: { code: "coach_blocked_player" } }), true);
});

test("isCoachBlockedPlayerError matches legacy error field", () => {
  assert.equal(isCoachBlockedPlayerError({ data: { error: "coach_blocked_player" } }), true);
});

test("getLessonAvailabilityErrorMessage hides coach block detail", () => {
  assert.equal(
    getLessonAvailabilityErrorMessage({ data: { code: "coach_blocked_player", detail: "Blocked by coach" } }, "Nope"),
    LESSON_UNAVAILABLE_TO_BOOK_MESSAGE,
  );
});

test("getLessonAvailabilityErrorMessage keeps normal API detail", () => {
  assert.equal(
    getLessonAvailabilityErrorMessage({ data: { detail: "Lesson full" } }, "Nope"),
    "Lesson full",
  );
});
