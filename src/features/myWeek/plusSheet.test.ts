import test from "node:test";
import assert from "node:assert/strict";

import {
  bookLessonDestination,
  newMatchOptions,
  logScoreAction,
  logScoreDestination,
  PLAN_BUTTON_LABEL,
  planSheetActions,
  plusSheetActions,
  PLUS_ACTION_PATHS,
  workoutDestination,
} from "./plusSheet";

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
  assert.deepEqual(plusSheetActions(false).map((action) => action.label), ["Create a match", "Log a score", "Find a match"]);
});

test("the Plan sheet (home v2) holds only things you start, in order, with subtitles", () => {
  assert.deepEqual(
    planSheetActions({ onLadder: false }).map((action) => [action.label, action.subtitle]),
    [
      ["New match", "Post a time and invite players"],
      ["Book a lesson", "Private or group, with a coach"],
      ["Book a restring", "String, tension and drop-off time"],
      ["Log a score", "Enter a result"],
      ["Add a workout", "From your 7-day plan"],
    ],
  );
  // Browsing lives in the Play tab.
  assert.ok(!planSheetActions({ onLadder: true }).some((action) => action.key === "findPlayers"));
  assert.equal(PLUS_ACTION_PATHS.bookRestring, "/restring");
  assert.equal(PLUS_ACTION_PATHS.logScore, "/log-result");
});

test("the ladder challenge is offered only to a player on the ladder, last", () => {
  const onLadder = planSheetActions({ onLadder: true });
  assert.equal(onLadder.at(-1)?.label, "Challenge on the ladder");
  assert.equal(PLUS_ACTION_PATHS.ladderChallenge, "/ladder");
  assert.equal(planSheetActions({ onLadder: false }).length, onLadder.length - 1);
});

test("the unlabeled + says what the sheet holds", () => {
  assert.equal(PLAN_BUTTON_LABEL, "Plan: new match, book a lesson, book a restring, log a score, add a workout");
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

test("New match offers Friendly, then one League match per running league", () => {
  assert.deepEqual(newMatchOptions([]).map((option) => option.key), ["friendly"]);
  const options = newMatchOptions([{ id: 4, name: "Fall Flex 4.0" }, { id: 9, name: " " }]);
  assert.deepEqual(
    options.map((option) => [option.label, option.subtitle, option.path]),
    [
      ["Friendly", "Post a time and invite players", "/create"],
      ["League match", "Fall Flex 4.0", "/leagues/4/dashboard"],
      ["League match", "Your league", "/leagues/9/dashboard"],
    ],
  );
  assert.ok(!options.some((option) => /rated/i.test(option.label)));
});

const waiting = (match_id: number, name: string, league?: { league_id: number; league_match_id: number }) => ({
  match_id,
  start_date_time: "2026-11-14T17:00:00Z",
  timezone: null,
  location_text: null,
  league_id: league?.league_id ?? null,
  league_match_id: league?.league_match_id ?? null,
  opponent: { id: 2, name },
});

test("Log a score names the match waiting for a score, with a green count", () => {
  assert.deepEqual(logScoreAction([]), { key: "logScore", label: "Log a score", subtitle: "Enter a result", type: null });
  const one = logScoreAction([waiting(5, "Ana Lopez")]);
  assert.equal(one.subtitle, "Your match vs Ana is waiting");
  assert.equal(one.badge, 1);
  assert.equal(one.tone, "success");
  assert.equal(logScoreAction([waiting(5, "Ana"), waiting(6, "Ben")]).subtitle, "2 matches are waiting for a score");
  assert.equal(planSheetActions({ onLadder: false, awaiting: [waiting(5, "Ana")] })[3].subtitle, "Your match vs Ana is waiting");
});

test("Log a score goes straight into the one waiting match", () => {
  assert.equal(logScoreDestination([waiting(5, "Ana")]), "/log-result?match=5");
  assert.equal(logScoreDestination([waiting(5, "Ana", { league_id: 4, league_match_id: 31 })]), "/log-result?league=4&fixture=31");
  assert.equal(logScoreDestination([]), "/log-result");
  assert.equal(logScoreDestination([waiting(5, "Ana"), waiting(6, "Ben")]), "/log-result");
});
