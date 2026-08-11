import assert from "node:assert/strict";
import test from "node:test";

import {
  isCancelledLessonStatus,
  mergeAvailabilityDayGroups,
  type CoachProfileAvailabilityDay,
} from "./coachProfileAvailability";

type TestSlot = {
  id: string;
  type: "private" | "group";
  start: string;
  locationId?: number | null;
  sourceLessonId?: number;
};

const day = (isoDate: string, slots: TestSlot[]): CoachProfileAvailabilityDay<TestSlot> => ({
  isoDate,
  dayLabel: isoDate,
  dateLabel: isoDate,
  shortDateLabel: isoDate.slice(-2),
  slots,
});

test("mergeAvailabilityDayGroups keeps profile slots and fills missing schedule days", () => {
  const merged = mergeAvailabilityDayGroups(
    [
      day("2026-08-11", [
        {
          id: "2026-08-11-group-2613",
          type: "group",
          sourceLessonId: 2613,
          start: "2026-08-11T18:30:00.000Z",
        },
      ]),
      day("2026-08-13", [
        {
          id: "2026-08-13-1122-540",
          type: "private",
          start: "2026-08-13T09:00:00.000Z",
        },
      ]),
    ],
    [
      day("2026-08-10", [
        {
          id: "2026-08-10-1119-540",
          type: "private",
          start: "2026-08-10T09:00:00.000Z",
        },
      ]),
      day("2026-08-11", [
        {
          id: "2026-08-11-1120-540",
          type: "private",
          start: "2026-08-11T09:00:00.000Z",
        },
      ]),
      day("2026-08-12", [
        {
          id: "2026-08-12-1121-540",
          type: "private",
          start: "2026-08-12T09:00:00.000Z",
        },
      ]),
    ],
  );

  assert.deepEqual(
    merged.map((entry) => entry.isoDate),
    ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"],
  );
  assert.deepEqual(
    merged.find((entry) => entry.isoDate === "2026-08-11")?.slots.map((slot) => slot.id),
    ["2026-08-11-1120-540", "2026-08-11-group-2613"],
  );
});

test("mergeAvailabilityDayGroups dedupes existing profile lesson slots", () => {
  const merged = mergeAvailabilityDayGroups(
    [
      day("2026-08-11", [
        {
          id: "profile-group",
          type: "group",
          sourceLessonId: 2613,
          start: "2026-08-11T18:30:00.000Z",
        },
      ]),
    ],
    [
      day("2026-08-11", [
        {
          id: "schedule-group",
          type: "group",
          sourceLessonId: 2613,
          start: "2026-08-11T18:30:00.000Z",
        },
      ]),
    ],
  );

  assert.deepEqual(merged[0].slots.map((slot) => slot.id), ["profile-group"]);
});

test("mergeAvailabilityDayGroups dedupes private slots with different generated ids", () => {
  const merged = mergeAvailabilityDayGroups(
    [
      day("2026-08-13", [
        {
          id: "2026-08-13-1122-540",
          type: "private",
          start: "2026-08-13T09:00:00.000Z",
          locationId: 37,
        },
      ]),
    ],
    [
      day("2026-08-13", [
        {
          id: "2026-08-13-private-0-0",
          type: "private",
          start: "2026-08-13T09:00:00.000Z",
          locationId: 37,
        },
      ]),
    ],
  );

  assert.deepEqual(merged[0].slots.map((slot) => slot.id), ["2026-08-13-1122-540"]);
});

test("isCancelledLessonStatus treats cancelled lessons as open schedule time", () => {
  assert.equal(isCancelledLessonStatus(2), true);
  assert.equal(isCancelledLessonStatus("2"), true);
  assert.equal(isCancelledLessonStatus("CANCELLED"), true);
  assert.equal(isCancelledLessonStatus(1), false);
});
