import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingMetaLabel,
  groupLessonsToBookings,
  lessonsToBookings,
  matchesToBookings,
  nextBookingLabel,
  nextTodayBooking,
  summariseWeekBookings,
  todayTimeLabel,
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

// --- today row --------------------------------------------------------------

// Anchored to local noon rather than a UTC instant: "today" is a local calendar
// day, so a test built on Date.UTC would pass or fail depending on the machine's
// timezone. From local noon, ±hours stay inside the same local day everywhere.
const LOCAL_NOON = new Date(2026, 7, 16, 12, 0, 0).getTime();
const localTime = (h, m = 0) => new Date(2026, 7, 16, h, m, 0).getTime();

test("today row takes the soonest booking still to come today", () => {
  const booking = nextTodayBooking(
    [
      { id: "later", kind: "match", startsAt: localTime(20) },
      { id: "soonest", kind: "group", startsAt: localTime(18) },
      { id: "past", kind: "lesson", startsAt: localTime(9) },
    ],
    LOCAL_NOON,
  );

  assert.equal(booking?.id, "soonest");
});

test("today row is null, never a zero-ish booking, when nothing is left today", () => {
  // The rule that has bitten twice: absence must be null so the row does not
  // render, rather than a falsy value that renders "Today, —".
  assert.equal(nextTodayBooking([], LOCAL_NOON), null);
  assert.equal(
    nextTodayBooking([{ id: "tomorrow", kind: "match", startsAt: LOCAL_NOON + DAY }], LOCAL_NOON),
    null,
  );
  assert.equal(
    nextTodayBooking([{ id: "earlier", kind: "match", startsAt: localTime(9) }], LOCAL_NOON),
    null,
  );
  assert.equal(todayTimeLabel(null), null);
});

test("late-evening bookings are still today in local time", () => {
  // 11pm local is today; the same instant is already tomorrow in UTC for much
  // of the world, which is the bug this anchoring exists to avoid.
  const booking = nextTodayBooking(
    [{ id: "late", kind: "lesson", startsAt: localTime(23, 30) }],
    LOCAL_NOON,
  );

  assert.equal(booking?.id, "late");
  assert.match(todayTimeLabel(booking), /^Today, /);
});

test("the today label keeps :00 minutes, matching the mockups", () => {
  // The tile's "Next Sat 10 AM" drops them; the today row's "Today, 6:00 PM"
  // does not. Both forms appear in the mockups, so this is deliberate.
  assert.match(todayTimeLabel({ id: "a", kind: "match", startsAt: localTime(18, 0) }), /6:00/);
  assert.match(todayTimeLabel({ id: "b", kind: "match", startsAt: localTime(18, 30) }), /6:30/);
});

test("today row ignores midnight on either side", () => {
  const justBefore = new Date(2026, 7, 16, 23, 59, 59).getTime();
  const justAfter = new Date(2026, 7, 17, 0, 0, 0).getTime();

  assert.equal(nextTodayBooking([{ id: "in", kind: "match", startsAt: justBefore }], LOCAL_NOON)?.id, "in");
  assert.equal(nextTodayBooking([{ id: "out", kind: "match", startsAt: justAfter }], LOCAL_NOON), null);
});

// --- title / location passthrough -------------------------------------------

test("group lessons and matches carry their title and location through", () => {
  const [group] = groupLessonsToBookings(
    [{ id: 5, startDateTime: at(HOUR), title: "Cardio tennis", locationName: "Penmar" }],
    () => true,
  );
  assert.equal(group.title, "Cardio tennis");
  assert.equal(group.location, "Penmar");
  assert.equal(bookingMetaLabel(group), "Cardio tennis · Penmar");

  const [match] = matchesToBookings([
    { id: 9, relationship: "host", startDateTimeIso: at(HOUR), format: "Singles", location: "Mar Vista" },
  ]);
  assert.equal(bookingMetaLabel(match), "Singles · Mar Vista");
});

test("a booking with neither title nor location yields no meta line at all", () => {
  // PlayerLesson declares neither, so this is the ordinary 1:1 lesson case —
  // it must produce null, not "undefined · undefined" and not a bare "·".
  const [lesson] = lessonsToBookings([
    { id: 1, status: 1, payment_status: 1, start_date_time: at(HOUR) },
  ]);

  assert.equal(lesson.title, null);
  assert.equal(lesson.location, null);
  assert.equal(bookingMetaLabel(lesson), null);
});

test("one known part renders alone, without a dangling separator", () => {
  assert.equal(
    bookingMetaLabel({ id: "a", kind: "match", startsAt: NOW, title: "Singles", location: null }),
    "Singles",
  );
  assert.equal(
    bookingMetaLabel({ id: "b", kind: "match", startsAt: NOW, title: "   ", location: "Penmar" }),
    "Penmar",
  );
  assert.equal(bookingMetaLabel(null), null);
});
