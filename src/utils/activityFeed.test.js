import moment from "moment";
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityItems,
  buildCoachActivities,
  buildDayTabs,
  collapseCoachAvailability,
  buildExternalLessonActivities,
  buildMatchActivities,
  filterActivities,
  filterToMyCoaches,
  itemsWithinWindow,
  matchesActivityTypeFilter,
  localSortKey,
  parseActualMoment,
  parseNearbyMoment,
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

test("coach availability shows the venue wall-clock time, not the UTC instant", () => {
  const [item] = buildCoachActivities([
    {
      coach_id: 26,
      coach_name: "Paul Cochrane",
      availability: [
        {
          day: "FRIDAY",
          date: "2026-08-28",
          from: "09:00:00",
          to: "10:00:00",
          start_date_time: "2026-08-28T16:00:00.000Z",
          end_date_time: "2026-08-28T17:00:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(item.time, "9 AM");
  assert.equal(item.dayKey, "2026-08-28");
  assert.equal(item.startTime, "2026-08-28T16:00:00.000Z");
});

// --- window bounding --------------------------------------------------------

test('"all" means all of this week, not everything the API returned', () => {
  // A session dated before the window is invisible under every day chip; without
  // the bound it still shows under All, and the counts stop summing.
  const items = [
    { id: "yesterday", dayKey: "2026-08-18", type: "group" },
    { id: "today", dayKey: "2026-08-19", type: "group" },
    { id: "friday", dayKey: "2026-08-21", type: "match" },
  ];
  const win = { windowStart: "2026-08-19", windowEnd: "2026-08-25" };

  const bounded = itemsWithinWindow({ items, ...win });
  assert.deepEqual(bounded.map((i) => i.id), ["today", "friday"]);

  const tabs = buildDayTabs({ items: bounded, ...win, now: "2026-08-19" });
  assert.equal(tabs[0].count, 2);
  assert.equal(tabs.slice(1).reduce((n, t) => n + t.count, 0), tabs[0].count);
});

test("a session after the window is dropped too, not just a stale one", () => {
  const items = [
    { id: "inside", dayKey: "2026-08-20", type: "match" },
    { id: "next-month", dayKey: "2026-09-20", type: "match" },
  ];
  const bounded = itemsWithinWindow({ items, windowStart: "2026-08-19", windowEnd: "2026-08-25" });

  assert.deepEqual(bounded.map((i) => i.id), ["inside"]);
});

test("no window means no bound, so the legacy dashboard is unaffected", () => {
  const items = [{ id: "a", dayKey: "2020-01-01", type: "match" }];

  assert.equal(itemsWithinWindow({ items, windowStart: null, windowEnd: null }).length, 1);
  assert.equal(itemsWithinWindow({ items }).length, 1);
});

test("an item with no dayKey is dropped rather than assumed to be in range", () => {
  const items = [{ id: "no-day", type: "match" }, { id: "ok", dayKey: "2026-08-20", type: "match" }];
  const bounded = itemsWithinWindow({ items, windowStart: "2026-08-19", windowEnd: "2026-08-25" });

  assert.deepEqual(bounded.map((i) => i.id), ["ok"]);
});

// --- coach availability collapse --------------------------------------------

const slot = (coachId, dayKey, time, startTime, price = 100) => ({
  id: `${coachId}-${startTime}`,
  source: "coach_availability",
  type: "private",
  coachId,
  dayKey,
  time,
  startTime,
  price,
  title: `Coach ${coachId}`,
});

test("a coach's slots collapse to one card per coach per day", () => {
  const collapsed = collapseCoachAvailability([
    slot(1, "2026-08-21", "10:00 AM", "2026-08-21T17:00:00Z"),
    slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z"),
    slot(1, "2026-08-21", "11:00 AM", "2026-08-21T18:00:00Z"),
    slot(1, "2026-08-22", "9:00 AM", "2026-08-22T16:00:00Z"),
    slot(2, "2026-08-21", "8:00 AM", "2026-08-21T15:00:00Z"),
  ]);

  assert.equal(collapsed.length, 3); // coach1/Fri, coach1/Sat, coach2/Fri
  const friday = collapsed.find((i) => i.coachId === 1 && i.dayKey === "2026-08-21");
  assert.equal(friday.slotCount, 3);
});

test("the earliest slot is the one shown, whatever order they arrive in", () => {
  const [card] = collapseCoachAvailability([
    slot(1, "2026-08-21", "3:00 PM", "2026-08-21T22:00:00Z"),
    slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z"),
  ]);

  // "4 slots from 9:00 AM" has to be true, so the earliest must win.
  assert.equal(card.time, "9:00 AM");
  assert.equal(card.startTime, "2026-08-21T16:00:00Z");
});

test("a price is only quoted outright when every slot agrees", () => {
  const [same] = collapseCoachAvailability([
    slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z", 100),
    slot(1, "2026-08-21", "10:00 AM", "2026-08-21T17:00:00Z", 100),
  ]);
  assert.equal(same.price, 100);
  assert.ok(!same.priceFrom);

  const [mixed] = collapseCoachAvailability([
    slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z", 120),
    slot(1, "2026-08-21", "10:00 AM", "2026-08-21T17:00:00Z", 80),
  ]);
  assert.equal(mixed.price, 80, "shows the lowest, so the figure is always bookable");
  assert.equal(mixed.priceFrom, true);
});

test("everything that is not coach availability passes through untouched", () => {
  const others = [
    { id: "g", type: "group", dayKey: "2026-08-21" },
    { id: "m", type: "match", dayKey: "2026-08-21" },
    // A 1:1 listing from the lessons endpoint is also type "private" — it must
    // not be collapsed with a coach's diary.
    { id: "listing", type: "private", dayKey: "2026-08-21" },
  ];
  const collapsed = collapseCoachAvailability(others);

  assert.deepEqual(collapsed.map((i) => i.id), ["g", "m", "listing"]);
  assert.ok(collapsed.every((i) => i.slotCount === undefined));
});

test("coach availability with no coach id is left alone rather than merged blindly", () => {
  const items = [
    { ...slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z"), coachId: null },
    { ...slot(1, "2026-08-21", "10:00 AM", "2026-08-21T17:00:00Z"), coachId: null },
  ];

  assert.equal(collapseCoachAvailability(items).length, 2);
});

test("collapsing does not mutate the caller's items", () => {
  const input = [
    slot(1, "2026-08-21", "9:00 AM", "2026-08-21T16:00:00Z"),
    slot(1, "2026-08-21", "10:00 AM", "2026-08-21T17:00:00Z"),
  ];
  collapseCoachAvailability(input);

  assert.equal(input[0].slotCount, undefined);
  assert.equal(input.length, 2);
});

// --- my coaches filter ------------------------------------------------------

test("only sessions attributable to one of my coaches survive the filter", () => {
  const items = [
    { id: "mine-avail", coachId: 7, type: "private" },
    { id: "mine-lesson", coachId: 9, type: "group" },
    { id: "someone-else", coachId: 42, type: "private" },
    { id: "unattributed", type: "group" },
  ];

  const mine = filterToMyCoaches(items, [7, 9]);
  assert.deepEqual(mine.map((i) => i.id), ["mine-avail", "mine-lesson"]);
});

test("an unattributable session is excluded, never assumed to be a match", () => {
  // We cannot tell whose lesson it is, so claiming it is with your coach would
  // be worse than leaving it out.
  const items = [{ id: "no-coach", type: "group" }, { id: "null-coach", coachId: null, type: "group" }];

  assert.deepEqual(filterToMyCoaches(items, [7]), []);
});

test("ids compare across string and number, since the sources disagree", () => {
  const items = [{ id: "a", coachId: "7" }, { id: "b", coachId: 8 }];

  assert.deepEqual(filterToMyCoaches(items, ["7", 8]).map((i) => i.id), ["a", "b"]);
});

test("no coaches means the filter yields nothing, which is why it is not offered", () => {
  const items = [{ id: "a", coachId: 7 }];

  assert.deepEqual(filterToMyCoaches(items, []), []);
  assert.deepEqual(filterToMyCoaches(items), []);
  assert.deepEqual(filterToMyCoaches(items, [null, undefined, "x"]), []);
});

/**
 * The feed reads four different shapes out of one field name, and one reader
 * cannot be right for all of them.
 *
 *   group lessons      "2026-08-28T09:00:00.000Z"   fictional Z — a venue clock
 *   external lessons   "2026-08-23T15:00:00"        no marker  — a local clock
 *   matches            "2026-08-22T23:00:00.000Z"   real Z     — a real instant
 *
 * parseZone was used for all three. It got the last two wrong in opposite
 * directions, so both are pinned here.
 */
test("an external lesson later today is not discarded as already past", () => {
  // Reported at 11:45 local: a 3pm lesson was missing from the Today tab.
  // parseZone read the bare timestamp as 15:00 UTC — 8am local — so the feed's
  // future check dropped it.
  const at1145 = moment("2026-08-23T11:45:00");
  const start = parseActualMoment("2026-08-23T15:00:00");

  assert.equal(start.format("h:mm A"), "3:00 PM", "a bare timestamp is a local clock");
  assert.equal(start.isSameOrAfter(at1145, "minute"), true, "still upcoming at 11:45");

  // What the old reader did, kept so the regression is visible.
  const viaParseZone = moment.parseZone("2026-08-23T15:00:00");
  assert.equal(viaParseZone.utcOffset(), 0, "parseZone assigns offset 0 to a bare value");
  assert.equal(moment(viaParseZone.toDate()).isSameOrAfter(at1145, "minute"), false, "which is why it vanished");
});

test("a match shows the time it actually starts", () => {
  // Match 174: stored 23:00Z, genuinely 4:00 PM — the share card agrees.
  const start = parseActualMoment("2026-08-22T23:00:00.000Z");

  assert.equal(start.format("h:mm A"), "4:00 PM");
  assert.equal(start.format("YYYY-MM-DD"), "2026-08-22", "and on the right day");
  assert.equal(moment.parseZone("2026-08-22T23:00:00.000Z").format("h:mm A"), "11:00 PM", "the old reading");
});

test("group lessons keep the floating reading, which was already right", () => {
  // A 9am class comes back as 09:00Z and must stay 9am, not convert to 2am.
  const start = parseNearbyMoment("2026-08-28T09:00:00.000Z");

  assert.equal(start.format("h:mm A"), "9:00 AM");
  assert.equal(start.format("YYYY-MM-DD"), "2026-08-28");
});

test("parseActualMoment falls through empties and rejects nonsense", () => {
  assert.equal(parseActualMoment(null, undefined, "", "2026-08-23T15:00:00").format("h:mm A"), "3:00 PM");
  assert.equal(parseActualMoment(), null);
  assert.equal(parseActualMoment("not a date"), null);
});

test("the feed orders by the clock the player reads, across all four sources", () => {
  // Reported: a 6pm private slot appearing above a morning group lesson, which
  // reads as the list being grouped by type. Cause: startTime is an ISO instant
  // and the sources disagree on what an instant means, so converted items
  // (external lessons, matches) sorted seven hours late.
  const keys = [
    { what: "group 7:00 AM", key: localSortKey(parseNearbyMoment("2026-08-24T07:00:00.000Z")) },
    { what: "private 6:00 PM", key: localSortKey(parseNearbyMoment("2026-08-24T18:00:00.000Z")) },
    { what: "external 3:00 PM", key: localSortKey(parseActualMoment("2026-08-24T15:00:00")) },
    { what: "match 4:00 PM", key: localSortKey(parseActualMoment("2026-08-24T23:00:00.000Z")) },
  ];

  const ordered = [...keys].sort((a, b) => a.key.localeCompare(b.key)).map((k) => k.what);
  assert.deepEqual(ordered, [
    "group 7:00 AM",
    "external 3:00 PM",
    "match 4:00 PM",
    "private 6:00 PM",
  ]);
});

test("sorting on startTime is what put a 6pm slot above a 3pm lesson", () => {
  // Kept so the regression is visible rather than described.
  const sixPmSlot = parseNearbyMoment("2026-08-24T18:00:00.000Z").toISOString();
  const threePmExternal = parseActualMoment("2026-08-24T15:00:00").toISOString();

  assert.ok(sixPmSlot < threePmExternal, "the old key ordered them wrongly");
  assert.ok(
    localSortKey(parseNearbyMoment("2026-08-24T18:00:00.000Z")) >
      localSortKey(parseActualMoment("2026-08-24T15:00:00")),
    "the new key orders them correctly",
  );
});

test("localSortKey falls back to the raw date when no parsed moment exists", () => {
  const key = localSortKey(null, new Date("2026-08-24T15:00:00"));
  assert.match(key, /^2026-08-24T\d{2}:\d{2}$/);
});
