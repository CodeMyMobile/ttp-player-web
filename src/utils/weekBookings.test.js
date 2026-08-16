import assert from "node:assert/strict";
import test from "node:test";

import {
  groupLessonsToBookings,
  lessonsToBookings,
  matchesToBookings,
  nextBookingLabel,
  summariseWeekBookings,
} from "./weekBookings";

const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);
const HOUR = 3_600_000;
const DAY = 86_400_000;
const at = (offset) => new Date(NOW + offset).toISOString();

test("counts only bookings inside the rolling 7 days", () => {
  const summary = summariseWeekBookings(
    [
      { id: "past", kind: "match", startsAt: NOW - HOUR },
      { id: "soon", kind: "match", startsAt: NOW + HOUR },
      { id: "edge", kind: "match", startsAt: NOW + 7 * DAY - 1 },
      { id: "beyond", kind: "match", startsAt: NOW + 7 * DAY },
    ],
    NOW,
  );

  assert.equal(summary.count, 2);
  assert.equal(summary.next.id, "soon");
});

test("next is the soonest, not the first supplied", () => {
  const summary = summariseWeekBookings(
    [
      { id: "later", kind: "lesson", startsAt: NOW + 3 * DAY },
      { id: "sooner", kind: "group", startsAt: NOW + 2 * HOUR },
    ],
    NOW,
  );

  assert.equal(summary.next.id, "sooner");
});

test("empty week yields a zero count and no next", () => {
  assert.deepEqual(summariseWeekBookings([], NOW), { count: 0, next: null });
});

test("private lessons count only when booked and paid", () => {
  const rows = [
    { id: 1, start_date_time: at(HOUR), status: 1, payment_status: 1 },
    { id: 2, start_date_time: at(2 * HOUR), status: 1, payment_status: 0 },
    { id: 3, start_date_time: at(3 * HOUR), status: 2, payment_status: 1 },
  ];

  assert.deepEqual(lessonsToBookings(rows).map((b) => b.id), ["1"]);
});

test("lessons prefer the timezone-qualified start field", () => {
  const [booking] = lessonsToBookings([
    { id: 9, start_date_time_tz: at(HOUR), start_date_time: at(5 * DAY), status: 1, payment_status: 1 },
  ]);

  assert.equal(booking.startsAt, NOW + HOUR);
});

test("group lessons defer the confirmed rule to the caller", () => {
  const lessons = [
    { id: 10, startDateTime: at(HOUR) },
    { id: 11, startDateTime: at(2 * HOUR) },
  ];
  const holdsSpot = (lesson) => lesson.id === 10;

  assert.deepEqual(groupLessonsToBookings(lessons, holdsSpot).map((b) => b.id), ["10"]);
});

test("matches count when hosting or participating, never as a viewer", () => {
  const matches = [
    { id: 20, relationship: "host", startDateTimeIso: at(HOUR) },
    { id: 21, relationship: "participant", startDateTimeIso: at(2 * HOUR) },
    // A pending invite is a viewer relationship — it must not be counted.
    { id: 22, relationship: "viewer", startDateTimeIso: at(3 * HOUR) },
  ];

  assert.deepEqual(matchesToBookings(matches).map((b) => b.id), ["20", "21"]);
});

test("items without a usable start time are dropped rather than counted as now", () => {
  assert.deepEqual(lessonsToBookings([{ id: 1, status: 1, payment_status: 1 }]), []);
  assert.deepEqual(matchesToBookings([{ id: 2, relationship: "host" }]), []);
  assert.deepEqual(groupLessonsToBookings([{ id: 3 }], () => true), []);
});

test("the same booking is not counted twice", () => {
  const summary = summariseWeekBookings(
    [
      { id: "77", kind: "match", startsAt: NOW + HOUR },
      { id: "77", kind: "match", startsAt: NOW + HOUR },
    ],
    NOW,
  );

  assert.equal(summary.count, 1);
});

test("next label reads as a weekday, or today when it is today", () => {
  assert.match(nextBookingLabel({ id: "a", kind: "match", startsAt: NOW + 2 * HOUR }, NOW), /^Next today, /);
  assert.match(nextBookingLabel({ id: "b", kind: "match", startsAt: NOW + 3 * DAY }, NOW), /^Next \w{3} /);
  assert.equal(nextBookingLabel(null, NOW), null);
});
