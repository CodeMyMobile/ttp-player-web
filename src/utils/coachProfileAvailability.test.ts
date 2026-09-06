import assert from "node:assert/strict";
import test from "node:test";

import {
  countSlotsInWindow,
  currentWeekWindow,
  getAvailabilitySlotPeriod,
  isCancelledLessonStatus,
  mergeAvailabilityDayGroups,
  parseCoachAvailabilityClock,
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

test("parseCoachAvailabilityClock treats schedule clock labels as UTC", () => {
  const parsed = parseCoachAvailabilityClock("2026-08-11", "10:00 AM");

  assert.equal(parsed?.toISOString(), "2026-08-11T10:00:00.000Z");
});

test("getAvailabilitySlotPeriod uses displayed slot time", () => {
  assert.equal(getAvailabilitySlotPeriod("9:00 AM"), "morning");
  assert.equal(getAvailabilitySlotPeriod("12:00 PM"), "afternoon");
  assert.equal(getAvailabilitySlotPeriod("5:00 PM"), "evening");
});

// --- "this week" slot count -------------------------------------------------

/** The real staging payload for coach 246: ten dates, Sep 7–18, 132 slots. */
const SEP_7_TO_18 = [
  { isoDate: "2026-09-07", slots: Array(14).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-08", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-09", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-10", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-11", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-14", slots: Array(14).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-15", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-16", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-17", slots: Array(13).fill({ id: "s", start: "" }) },
  { isoDate: "2026-09-18", slots: Array(13).fill({ id: "s", start: "" }) },
];

test('"this week" counts the week, not the whole booking payload', () => {
  // The bug: 132 was rendered beside the Book button under a "this week" label.
  assert.equal(SEP_7_TO_18.reduce((n, d) => n + d.slots.length, 0), 132);
  // Mon Sep 7 through Sun Sep 13 — the second week is excluded entirely.
  assert.equal(countSlotsInWindow(SEP_7_TO_18, "2026-09-07", "2026-09-13"), 66);
});

test("the slot window includes both of its ends", () => {
  const days = [
    { isoDate: "2026-09-06", slots: [{ id: "a", start: "" }] },
    { isoDate: "2026-09-07", slots: [{ id: "b", start: "" }] },
    { isoDate: "2026-09-13", slots: [{ id: "c", start: "" }] },
    { isoDate: "2026-09-14", slots: [{ id: "d", start: "" }] },
  ];
  // Today and the seventh day both count; the days either side of them do not.
  assert.equal(countSlotsInWindow(days, "2026-09-07", "2026-09-13"), 2);
});

test("the slot count tolerates missing days and missing slots", () => {
  assert.equal(countSlotsInWindow([], "2026-09-07", "2026-09-13"), 0);
  assert.equal(
    countSlotsInWindow(
      [{ isoDate: "2026-09-08", slots: undefined as never }],
      "2026-09-07",
      "2026-09-13",
    ),
    0,
  );
});

test("the week window is seven days inclusive", () => {
  const { windowStart, windowEnd } = currentWeekWindow("2026-09-07");
  assert.equal(windowStart, "2026-09-07");
  // +6, not +7: a seven-day window counted inclusively ends on the seventh day.
  assert.equal(windowEnd, "2026-09-13");
});
