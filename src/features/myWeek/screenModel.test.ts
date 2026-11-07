process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { dayCards, dayHeading, initialsOf, laterLabel, loadDots, stripLabel, timeLabel, weekRangeLabel } from "./screenModel";
import type { WeekDayItems, WeekItem } from "./types";

const item = (overrides: Partial<WeekItem>): WeekItem => ({
  id: "match:1",
  source: "match",
  type: "match",
  state: "booked",
  needsResponse: false,
  dayKey: "2026-11-07",
  time: { kind: "fixed", startsAt: new Date(2026, 10, 7, 19, 30).getTime() },
  title: "Match at Penmar Park",
  subtitle: null,
  people: [],
  reason: null,
  actions: ["open"],
  href: "/matches/1",
  raw: null,
  ...overrides,
});

test("a sent invite joins its match's card instead of being a card of its own", () => {
  const match = item({ id: "match:40" });
  const waiting = item({ id: "sentInvite:40", source: "sentInvite", state: "pending", needsResponse: true });
  const lesson = item({ id: "lesson:3", source: "lesson", type: "lesson" });
  const cards = dayCards([match, waiting, lesson]);
  assert.deepEqual(
    cards.map((card) => [card.item.id, card.waiting?.id ?? null]),
    [
      ["match:40", "sentInvite:40"],
      ["lesson:3", null],
    ],
  );
});

test("a sent invite whose match isn't there still shows, so the nudge isn't lost", () => {
  const cards = dayCards([item({ id: "sentInvite:41", source: "sentInvite", state: "pending" })]);
  assert.deepEqual(cards.map((card) => card.item.id), ["sentInvite:41"]);
});

test("day headings and strip labels", () => {
  assert.equal(dayHeading("2026-11-06", "2026-11-06", "2026-11-07"), "Today");
  assert.equal(dayHeading("2026-11-07", "2026-11-06", "2026-11-07"), "Tomorrow");
  assert.equal(dayHeading("2026-11-08", "2026-11-06", "2026-11-07"), "Sun 8 Nov");
  assert.deepEqual(stripLabel("2026-11-06", 0), { top: "Today", date: 6 });
  assert.deepEqual(stripLabel("2026-11-08", 2), { top: "Sun", date: 8 });
});

const days = (keys: string[]): WeekDayItems[] => keys.map((dayKey) => ({ dayKey, items: [], load: 0, hasWaiting: false }));

test("the week's range reads as one span, naming the month once unless it changes", () => {
  assert.equal(weekRangeLabel(days(["2026-11-06", "2026-11-12"])), "Fri 6 – Thu 12 Nov");
  assert.equal(weekRangeLabel(days(["2026-11-30", "2026-12-06"])), "Mon 30 Nov – Sun 6 Dec");
});

test("times: a clock time, or the flexible label", () => {
  assert.equal(timeLabel(item({})), "7:30 PM");
  assert.equal(timeLabel(item({ time: { kind: "flexible", label: "Due by Tue" } })), "Due by Tue");
  assert.equal(
    laterLabel(item({ time: { kind: "fixed", startsAt: new Date(2026, 10, 15, 9, 0).getTime() } })),
    "Sun 15 Nov, 9:00 AM",
  );
});

test("load dots: one per card by type, the sent invite not counted twice, at most three", () => {
  const day: WeekDayItems = {
    dayKey: "2026-11-07",
    items: [
      item({ id: "match:40" }),
      item({ id: "sentInvite:40", source: "sentInvite", state: "pending" }),
      item({ id: "lesson:1", source: "lesson", type: "lesson" }),
      item({ id: "lesson:2", source: "lesson", type: "lesson" }),
      item({ id: "lesson:3", source: "lesson", type: "lesson" }),
    ],
    load: 5,
    hasWaiting: false,
  };
  assert.deepEqual(loadDots(day), ["match", "lesson", "lesson"]);
});

test("initials", () => {
  assert.equal(initialsOf("Alex Kim"), "AK");
  assert.equal(initialsOf("Jo"), "J");
  assert.equal(initialsOf(""), "?");
});
