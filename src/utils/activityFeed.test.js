import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityItems,
  buildCoachActivities,
  buildDayTabs,
  buildExternalLessonActivities,
  buildMatchActivities,
  filterActivities,
  matchesActivityTypeFilter,
  typeCounts,
} from "./activityFeed";

// A window of Sun 2 Aug – Sat 8 Aug 2026, with "today" pinned to the Tuesday so
// the "Today" label is deterministic wherever this runs.
const WINDOW = { windowStart: "2026-08-02", windowEnd: "2026-08-08" };
const NOW = "2026-08-04";

const item = (dayKey, type, id) => ({ id: id ?? `${dayKey}-${type}`, dayKey, type });

const ITEMS = [
  item("2026-08-02", "private"),
  item("2026-08-04", "private"),
  item("2026-08-04", "group"),
  item("2026-08-04", "external"),
  item("2026-08-04", "match"),
  item("2026-08-07", "match"),
];

// --- day chips --------------------------------------------------------------

test("day chips lead with an All chip carrying the window and the full count", () => {
  const [all] = buildDayTabs({ items: ITEMS, ...WINDOW, now: NOW });

  assert.equal(all.key, "all");
  assert.equal(all.label, "All");
  assert.equal(all.date, "Wk");
  assert.equal(all.fullDate, "Aug 2 - Aug 8");
  assert.equal(all.count, 6);
});

test("one chip per day in the window, counted by dayKey", () => {
  const tabs = buildDayTabs({ items: ITEMS, ...WINDOW, now: NOW });

  assert.equal(tabs.length, 8); // All + 7 days
  const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.count]));
  assert.equal(byKey["2026-08-02"], 1);
  assert.equal(byKey["2026-08-04"], 4);
  assert.equal(byKey["2026-08-07"], 1);
  assert.equal(byKey["2026-08-03"], 0);
});

test("the current day is labelled Today, the rest by weekday", () => {
  const tabs = buildDayTabs({ items: ITEMS, ...WINDOW, now: NOW });
  const labels = tabs.slice(1).map((t) => t.label);

  assert.deepEqual(labels, ["Sun", "Mon", "Today", "Wed", "Thu", "Fri", "Sat"]);
  assert.equal(tabs.find((t) => t.label === "Today").key, "2026-08-04");
});

test("day counts sum to the All count", () => {
  const tabs = buildDayTabs({ items: ITEMS, ...WINDOW, now: NOW });
  const summed = tabs.slice(1).reduce((n, t) => n + t.count, 0);

  assert.equal(summed, tabs[0].count);
});

test("a single-day window renders one day, and a reversed one does not go negative", () => {
  const single = buildDayTabs({ items: [], windowStart: "2026-08-04", windowEnd: "2026-08-04", now: NOW });
  assert.equal(single.length, 2);
  assert.equal(single[0].fullDate, "Aug 4");

  const reversed = buildDayTabs({ items: [], windowStart: "2026-08-08", windowEnd: "2026-08-02", now: NOW });
  assert.equal(reversed.length, 2);
});

test("no items still renders the full set of chips, all at zero", () => {
  const tabs = buildDayTabs({ items: [], ...WINDOW, now: NOW });

  assert.equal(tabs.length, 8);
  assert.ok(tabs.every((t) => t.count === 0));
});

// --- type chips -------------------------------------------------------------

test("type counts are taken after the day filter, not across the window", () => {
  // The audit's requirement: the four chips must sum to the selected day chip.
  const counts = typeCounts({ items: ITEMS, selectedDay: "2026-08-04" });

  assert.deepEqual(counts, { all: 4, private: 1, group: 2, match: 1 });
  assert.equal(counts.private + counts.group + counts.match, counts.all);
});

test("external lessons count as groups, never as their own chip", () => {
  const counts = typeCounts({ items: ITEMS, selectedDay: "all" });

  assert.equal(counts.all, 6);
  assert.equal(counts.group, 2); // one group + one external
  assert.equal(counts.private + counts.group + counts.match, counts.all);
});

// --- filtering --------------------------------------------------------------

test("filtering by day and by type is independent", () => {
  const day = filterActivities({ items: ITEMS, selectedDay: "2026-08-04", selectedType: "all" });
  assert.equal(day.length, 4);

  const type = filterActivities({ items: ITEMS, selectedDay: "all", selectedType: "match" });
  assert.equal(type.length, 2);

  const both = filterActivities({ items: ITEMS, selectedDay: "2026-08-04", selectedType: "match" });
  assert.equal(both.length, 1);
});

test("the group filter includes external lessons", () => {
  const groups = filterActivities({ items: ITEMS, selectedDay: "all", selectedType: "group" });

  assert.deepEqual(groups.map((i) => i.type).sort(), ["external", "group"]);
});

test("a day with nothing in it filters to empty rather than falling back to all", () => {
  assert.deepEqual(filterActivities({ items: ITEMS, selectedDay: "2026-08-03", selectedType: "all" }), []);
});

test("matchesActivityTypeFilter passes everything under all", () => {
  assert.ok(ITEMS.every((i) => matchesActivityTypeFilter(i, "all")));
  assert.ok(matchesActivityTypeFilter({ type: "external" }, "group"));
  assert.ok(!matchesActivityTypeFilter({ type: "private" }, "match"));
});

// --- builders ---------------------------------------------------------------

test("every builder tolerates junk input rather than throwing", () => {
  for (const build of [
    buildCoachActivities,
    buildActivityItems,
    buildExternalLessonActivities,
    buildMatchActivities,
  ]) {
    assert.deepEqual(build([]), []);
    assert.deepEqual(build(), []);
  }
});
