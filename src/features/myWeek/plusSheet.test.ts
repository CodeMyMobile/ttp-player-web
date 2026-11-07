import test from "node:test";
import assert from "node:assert/strict";

import { bookLessonDestination, plusSheetActions, PLUS_ACTION_PATHS, workoutDestination } from "./plusSheet";

test("with My Week on: New match, Find players, Book a lesson, Add a workout", () => {
  assert.deepEqual(
    plusSheetActions(true).map((action) => [action.label, action.type]),
    [
      ["New match", "match"],
      ["Find players", "players"],
      ["Book a lesson", "lesson"],
      ["Add a workout", "workout"],
    ],
  );
  assert.equal(PLUS_ACTION_PATHS.newMatch, "/create");
  assert.equal(PLUS_ACTION_PATHS.findPlayers, "/find-players");
});

test("with it off, the sheet is today's", () => {
  assert.deepEqual(plusSheetActions(false).map((action) => action.label), ["Create a Match", "Log a Score", "Find a Match"]);
});

test("Book a lesson: one coach books with them, several open My Coaches, none finds a coach", () => {
  assert.equal(bookLessonDestination([{ coach_id: 20, status: 1 }]), "/coaches/20/book");
  assert.equal(bookLessonDestination([{ coach_id: 20, status: 1 }, { coach_id: 21, status: 0 }]), "/my-coaches");
  assert.equal(bookLessonDestination([]), "/find-coaches");
  assert.equal(bookLessonDestination(null), "/find-coaches");
});

test("a coach who ended the link doesn't count", () => {
  assert.equal(bookLessonDestination([{ coach_id: 20, status: 1 }, { coach_id: 21, status: 2 }]), "/coaches/20/book");
  assert.equal(bookLessonDestination([{ id: 22, status_text: "Cancelled" }]), "/find-coaches");
});

test("Add a workout: today's session once started (repeating after day 7), else the plan page", () => {
  assert.equal(workoutDestination(null, "2026-11-06"), "/training-plan");
  assert.equal(workoutDestination({ startedOn: "2026-11-04", done: {} }, "2026-11-06"), "/training-plan?day=3");
  assert.equal(workoutDestination({ startedOn: "2026-11-04", done: {} }, "2026-11-11"), "/training-plan?day=1");
});
