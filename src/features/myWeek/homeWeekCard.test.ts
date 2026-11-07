process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { bookedCount, nextUp, waitingLine } from "./homeWeekCard";
import type { WeekDayItems, WeekItem } from "./types";

const NOW = new Date(2026, 10, 6, 10, 0).getTime();
const HOUR = 3_600_000;

const item = (overrides: Partial<WeekItem>): WeekItem => ({
  id: "match:1",
  source: "match",
  type: "match",
  state: "booked",
  needsResponse: false,
  dayKey: "2026-11-06",
  time: { kind: "fixed", startsAt: NOW + HOUR },
  title: "Match",
  subtitle: null,
  people: [],
  reason: null,
  actions: ["open"],
  href: null,
  raw: null,
  ...overrides,
});

const day = (dayKey: string, items: WeekItem[]): WeekDayItems => ({ dayKey, items, load: items.length, hasWaiting: false });

test("booked counts booked items only", () => {
  const days = [
    day("2026-11-06", [item({}), item({ id: "invite:2", source: "invite", state: "pending", needsResponse: true })]),
    day("2026-11-07", [item({ id: "lesson:3", source: "lesson", type: "lesson" })]),
  ];
  assert.equal(bookedCount(days), 2);
});

test("next up is today's next item, skipping ones already over", () => {
  const days = [
    day("2026-11-06", [
      item({ id: "match:earlier", time: { kind: "fixed", startsAt: NOW - HOUR } }),
      item({ id: "match:later", time: { kind: "fixed", startsAt: NOW + 3 * HOUR } }),
      item({ id: "match:soon", time: { kind: "fixed", startsAt: NOW + HOUR } }),
    ]),
    day("2026-11-07", [item({ id: "lesson:tomorrow", dayKey: "2026-11-07", time: { kind: "fixed", startsAt: NOW + 24 * HOUR } })]),
  ];
  assert.deepEqual(nextUp(days, NOW)?.item.id, "match:soon");
  assert.equal(nextUp(days, NOW)?.isToday, true);
});

test("with nothing left today, it's the soonest later in the week", () => {
  const days = [
    day("2026-11-06", [item({ id: "match:over", time: { kind: "fixed", startsAt: NOW - HOUR } })]),
    day("2026-11-07", []),
    day("2026-11-08", [
      item({ id: "due", dayKey: "2026-11-08", time: { kind: "flexible", label: "Due by Sun" } }),
      item({ id: "lesson:sun", dayKey: "2026-11-08", time: { kind: "fixed", startsAt: NOW + 50 * HOUR } }),
    ]),
  ];
  assert.deepEqual(nextUp(days, NOW), { item: days[2].items[1], isToday: false });
});

test("an invite not yet accepted isn't 'next up', even when it's sooner", () => {
  const days = [
    day("2026-11-06", [
      item({ id: "invite:9", source: "invite", state: "pending", needsResponse: true, time: { kind: "fixed", startsAt: NOW + HOUR } }),
      item({ id: "lesson:4", source: "lesson", type: "lesson", time: { kind: "fixed", startsAt: NOW + 5 * HOUR } }),
    ]),
  ];
  assert.equal(nextUp(days, NOW)?.item.id, "lesson:4");
});

test("an empty week has nothing next", () => {
  assert.equal(nextUp([day("2026-11-06", [])], NOW), null);
});

const waiting = (token: string) =>
  item({ id: `invite:${token}`, source: "invite", state: "pending", needsResponse: true, raw: { token } });

test("the waiting line counts only what the invite card isn't showing", () => {
  // The card shows the only waiting item: no line.
  assert.equal(waitingLine([waiting("a")], "a"), null);
  // The card shows one of three.
  assert.equal(waitingLine([waiting("a"), waiting("b"), waiting("c")], "a"), "+2 more waiting on you");
  // No card.
  assert.equal(waitingLine([waiting("a"), waiting("b")], null), "2 waiting on you");
  // The card shows an invite My Week doesn't hold: nothing of ours is covered.
  assert.equal(waitingLine([waiting("b")], "zzz"), "1 waiting on you");
  // Nothing waiting.
  assert.equal(waitingLine([], "a"), null);
});
