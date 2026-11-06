// The app's players are in Los Angeles; these tests read local days there.
process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { isInWeek, isWallClockLessonType, readLessonStart, readStart, weekBounds, weekDays } from "./weekDays";

// Friday 6 Nov 2026, 10am in Los Angeles (PST, UTC-8).
const NOW = new Date(2026, 10, 6, 10, 0);

test("the week is today and the six days after it", () => {
  assert.deepEqual(
    weekDays(NOW).map((day) => day.dayKey),
    ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"],
  );
});

test("an evening match is on its Pacific day, though its UTC date is the next day", () => {
  // 7:30pm Saturday in Los Angeles.
  const start = readStart("2026-11-08T03:30:00.000Z", "instant");
  assert.equal(start?.dayKey, "2026-11-07");
  assert.equal(start?.startsAt, Date.UTC(2026, 10, 8, 3, 30));
});

test("a 9pm class stored with a Z stays on its own day and its own clock time", () => {
  const start = readStart("2026-11-07T21:00:00.000Z", "wallClock");
  assert.equal(start?.dayKey, "2026-11-07");
  assert.equal(start?.startsAt, new Date(2026, 10, 7, 21, 0).getTime());
  // Read as an instant it would be 1pm the same day: the bug this helper exists to avoid.
  assert.notEqual(readStart("2026-11-07T21:00:00.000Z", "instant")?.startsAt, start?.startsAt);
});

test("a 1am class read as an instant would jump to the previous evening", () => {
  assert.equal(readStart("2026-11-09T01:00:00.000Z", "wallClock")?.dayKey, "2026-11-09");
  assert.equal(readStart("2026-11-09T01:00:00.000Z", "instant")?.dayKey, "2026-11-08");
});

test("lessons pick the reading by type", () => {
  // Open group lesson: start_date_time is a wall clock.
  assert.equal(
    readLessonStart({ lessontype_id: 3, start_date_time: "2026-11-07T21:00:00.000Z" })?.startsAt,
    new Date(2026, 10, 7, 21, 0).getTime(),
  );
  // Private lesson: _tz is a wall clock and wins; start_date_time is the instant.
  assert.equal(
    readLessonStart({
      lessontype_id: 1,
      start_date_time_tz: "2026-11-07T18:30:00.000Z",
      start_date_time: "2026-11-08T02:30:00.000Z",
    })?.startsAt,
    new Date(2026, 10, 7, 18, 30).getTime(),
  );
  assert.equal(
    readLessonStart({ lessontype_id: 1, start_date_time: "2026-11-08T02:30:00.000Z" })?.dayKey,
    "2026-11-07",
  );
  assert.equal(isWallClockLessonType("4"), true);
  assert.equal(isWallClockLessonType(2), false);
});

test("seven calendar days across the end of daylight saving (1 Nov 2026)", () => {
  const days = weekDays(new Date(2026, 9, 29, 23, 30));
  assert.deepEqual(
    days.map((day) => day.dayKey),
    ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
  );
  // Every day starts at local midnight, including the 25-hour one.
  assert.ok(days.every((day) => day.start.getHours() === 0));
});

test("and across its start (8 Mar 2026)", () => {
  const days = weekDays(new Date(2026, 2, 7, 0, 30));
  assert.equal(days[1].dayKey, "2026-03-08");
  assert.equal(days[2].dayKey, "2026-03-09");
  assert.ok(days.every((day) => day.start.getHours() === 0));
});

test("bounds run from local midnight today to local midnight after day seven", () => {
  const { start, end } = weekBounds(NOW);
  assert.equal(start.getTime(), new Date(2026, 10, 6).getTime());
  assert.equal(end.getTime(), new Date(2026, 10, 13).getTime());
  const days = weekDays(NOW);
  assert.equal(isInWeek("2026-11-06", days), true);
  assert.equal(isInWeek("2026-11-12", days), true);
  assert.equal(isInWeek("2026-11-13", days), false);
  assert.equal(isInWeek("2026-11-05", days), false);
});

test("anything that isn't a time is null, not now", () => {
  assert.equal(readStart(undefined, "instant"), null);
  assert.equal(readStart("soon", "instant"), null);
  assert.equal(readStart(null, "wallClock"), null);
  assert.equal(readLessonStart({ lessontype_id: 3 }), null);
});
