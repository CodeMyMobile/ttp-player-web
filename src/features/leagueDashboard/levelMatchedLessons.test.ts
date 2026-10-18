import assert from "node:assert/strict";
import { test } from "node:test";

import type { GroupLesson } from "../../api/groupLessons";
import {
  leagueLevelOf,
  lessonsLinkState,
  levelBandLabel,
  matchLessonsToLevel,
  matchLevel,
  nudgeDetail,
  nudgeHeadline,
} from "./levelMatchedLessons";

// Start times are venue wall clocks stamped Z; "now" is a local wall clock to match.
const NOW = new Date(2026, 9, 20, 12, 0).getTime();

const lesson = (overrides: Partial<GroupLesson>): GroupLesson =>
  ({
    id: "1",
    title: "Liveball",
    coachName: "Sam Lee",
    level: null,
    skillLabel: "All levels",
    startDateTime: "2026-10-24T09:00:00.000Z",
    locationName: "Penmar Park, Venice, CA",
    availableSpots: 3,
    cancelled: false,
    ...overrides,
  }) as GroupLesson;

test("a class whose range overlaps the player's level is in, with its own range as the pill", () => {
  const [match] = matchLessonsToLevel([lesson({ title: "3.5-4.0 Drill" })], 4.0, NOW);
  assert.equal(match?.levelPill, "3.5–4.0");
  assert.equal(match?.spotsLabel, "3 spots left");
  assert.equal(match?.when, "Sat Oct 24 · 9:00 AM");
  assert.equal(match?.venue, "Penmar Park");
  assert.equal(match?.coachName, "Sam Lee");
});

test("a class out of range is out", () => {
  assert.deepEqual(matchLessonsToLevel([lesson({ title: "3.0 Basics" })], 4.0, NOW), []);
  assert.deepEqual(matchLessonsToLevel([lesson({ title: "5.0 Liveball" })], 4.0, NOW), []);
});

test("4.0+ fits a 4.0 and a 4.5, as on the lessons page", () => {
  const plus = [lesson({ title: "4.0+ Liveball" })];
  assert.equal(matchLessonsToLevel(plus, 4.0, NOW)[0]?.levelPill, "4.0+");
  assert.equal(matchLessonsToLevel(plus, 4.5, NOW).length, 1);
  assert.equal(matchLessonsToLevel(plus, 3.5, NOW).length, 0);
  assert.equal(matchLessonsToLevel(plus, 5.0, NOW).length, 0);
});

test("a class with no level stays off, though the lessons page shows it to everyone", () => {
  assert.deepEqual(matchLessonsToLevel([lesson({ title: "Saturday Clinic" })], 4.0, NOW), []);
});

test("full, cancelled, outside-provider and past classes are left out", () => {
  const lessons = [
    lesson({ id: "full", title: "4.0 Drill", availableSpots: 0 }),
    lesson({ id: "cancelled", title: "4.0 Drill", cancelled: true }),
    lesson({ id: "external", title: "4.0 Drill", isExternal: true }),
    lesson({ id: "past", title: "4.0 Drill", startDateTime: "2026-10-20T09:00:00.000Z" }),
  ];
  assert.deepEqual(matchLessonsToLevel(lessons, 4.0, NOW), []);
});

test("sorted soonest first, by the venue's wall clock", () => {
  const lessons = [
    lesson({ id: "later", title: "4.0 Drill", startDateTime: "2026-10-25T08:00:00.000Z" }),
    lesson({ id: "sooner", title: "4.0 Drill", startDateTime: "2026-10-20T18:30:00.000Z" }),
  ];
  assert.deepEqual(matchLessonsToLevel(lessons, 4.0, NOW).map((match) => match.id), ["sooner", "later"]);
});

test("no NTRP falls back to the league's level", () => {
  assert.equal(leagueLevelOf("Flex league · 4.0 · Men"), 4.0);
  assert.equal(leagueLevelOf("Flex league"), null);
  assert.equal(matchLevel(null, 4.0), 4.0);
  assert.equal(matchLevel(3.5, 4.0), 3.5);
  assert.equal(levelBandLabel(4.0), "4.0–4.5");
  assert.equal(levelBandLabel(3.67), "3.5–4.0");
});

test("no level and no lessons give nothing to show, so the card hides", () => {
  assert.deepEqual(matchLessonsToLevel([lesson({ title: "4.0 Drill" })], null, NOW), []);
  assert.deepEqual(matchLessonsToLevel([], 4.0, NOW), []);
});

test("the Browse link preselects Your level, or the league's level when the player has none", () => {
  assert.deepEqual(lessonsLinkState(4.0, 4.0), { groupLessonsState: { levelFilter: "Your level" } });
  assert.deepEqual(lessonsLinkState(null, 4.0), { groupLessonsState: { levelFilter: "4.0" } });
});

test("nudge copy: the gap to the player above, or holding first", () => {
  assert.equal(nudgeHeadline({ rank: 4, rating: 3.9 }, { rank: 3, rating: 4.02 }), "Close the 0.12 gap to #3");
  assert.equal(nudgeHeadline({ rank: 1, rating: 4.2 }, null), "Stay on top");
  const [next] = matchLessonsToLevel([lesson({ title: "4.0 Drill" })], 4.0, NOW);
  assert.equal(
    nudgeDetail("4.0–4.5", next ?? null),
    "Sharpen up with a 4.0–4.5 clinic this week · next: Sat 9:00 AM at Penmar Park",
  );
  assert.equal(nudgeDetail("4.0–4.5", null), "Sharpen up with a 4.0–4.5 clinic this week");
});
