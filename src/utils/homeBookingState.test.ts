import assert from "node:assert/strict";
import test from "node:test";

import type { WeekItem } from "../features/myWeek/types";
import {
  bookedKeysFromBookings,
  bookedKeysFromWeekItems,
  feedItemBookedKey,
  feedItemViewerState,
} from "./homeBookingState";

const weekItem = (over: Partial<WeekItem>): WeekItem => ({
  id: "match:40",
  source: "match",
  type: "match",
  state: "booked",
  needsResponse: false,
  dayKey: "2026-11-13",
  time: { kind: "fixed", startsAt: 0 },
  title: "Singles match",
  subtitle: null,
  people: [],
  reason: null,
  actions: ["open"],
  href: "/matches/40",
  raw: null,
  ...over,
});

const VIEWER = 1716;

test("a match the player is in shows You're in", () => {
  const bookedKeys = bookedKeysFromWeekItems([weekItem({})]);
  assert.equal(
    feedItemViewerState({ type: "match", lessonId: "40" }, { bookedKeys, viewerId: VIEWER }),
    "in",
  );
  assert.equal(
    feedItemViewerState({ type: "match", lessonId: "41" }, { bookedKeys, viewerId: VIEWER }),
    null,
  );
});

test("a group class the player is booked into shows You're in, from either source", () => {
  const fromWeek = bookedKeysFromWeekItems([weekItem({ id: "groupLesson:12", source: "groupLesson", type: "lesson" })]);
  const fromBookings = bookedKeysFromBookings([{ id: "12", kind: "group", startsAt: 0 }]);
  for (const bookedKeys of [fromWeek, fromBookings]) {
    assert.equal(feedItemViewerState({ type: "group", lessonId: "12" }, { bookedKeys, viewerId: VIEWER }), "in");
  }
});

test("invites and suggestions are not bookings", () => {
  const bookedKeys = bookedKeysFromWeekItems([
    weekItem({ id: "invite:40", source: "invite", state: "pending" }),
    weekItem({ id: "openMatch:41", source: "openMatch", state: "suggested" }),
    weekItem({ id: "match:42", state: "pending" }),
  ]);
  assert.equal(bookedKeys.size, 0);
});

test("the coach of a class sees You're coaching, not Book or You're in", () => {
  const bookedKeys = new Set(["group:12"]);
  assert.equal(
    feedItemViewerState({ type: "group", lessonId: "12", coachId: VIEWER }, { bookedKeys, viewerId: VIEWER }),
    "coaching",
  );
  assert.equal(
    feedItemViewerState(
      { type: "private", source: "coach_availability", coachId: String(VIEWER) },
      { bookedKeys, viewerId: VIEWER },
    ),
    "coaching",
  );
  assert.equal(
    feedItemViewerState({ type: "group", lessonId: "13", coachId: 99 }, { bookedKeys, viewerId: VIEWER }),
    null,
  );
});

test("no viewer id claims nothing about coaching", () => {
  assert.equal(
    feedItemViewerState({ type: "group", lessonId: "13", coachId: null }, { bookedKeys: new Set(), viewerId: null }),
    null,
  );
});

test("coach availability and external lessons are never bookings", () => {
  assert.equal(feedItemBookedKey({ type: "private", source: "coach_availability", lessonId: "7" }), null);
  assert.equal(feedItemBookedKey({ type: "external", lessonId: "7" }), null);
  assert.equal(feedItemBookedKey({ type: "private", lessonId: "7" }), "lesson:7");
});
