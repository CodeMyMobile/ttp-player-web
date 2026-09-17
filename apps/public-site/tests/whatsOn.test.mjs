import assert from "node:assert/strict";
import { test } from "node:test";

import {
  areaOf,
  bandOf,
  buildPublicClasses,
  buildPublicLeagues,
  formatDayTime,
  levelOf,
  venueOf,
} from "../src/lib/whatsOn.ts";

// Lesson 2637 as the API actually returns it.
const lesson2637 = {
  id: 2637,
  start_date_time: "2026-09-17T18:30:00.000Z",
  full_name: "Paul Cochrane",
  group_price_per_person: 42.5,
  location: "Culver City High School Tennis Court Culver City, CA 90230, USA",
  metadata: { level: "Advanced Plus (NTRP 4.5)", title: "Culver City 4.5 Liveball " },
};

test("a lesson start is read from the venue clock, never converted", () => {
  // 18:30 is 6:30pm at the court. Parsing it as UTC would make it 11:30am on a
  // Pacific build machine, and the card would advertise the wrong time.
  assert.equal(formatDayTime("2026-09-17T18:30:00.000Z"), "Thu 6:30pm");
  assert.equal(formatDayTime("2026-09-18T09:00:00.000Z"), "Fri 9:00am");
  assert.equal(formatDayTime("2026-09-17T12:00:00.000Z"), "Thu 12:00pm");
  assert.equal(formatDayTime("2026-09-17T00:15:00.000Z"), "Thu 12:15am");
  assert.equal(formatDayTime(null), null);
});

test("the same digits give the same answer in any build timezone", () => {
  const original = process.env.TZ;
  const seen = new Set();
  for (const zone of ["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Tokyo"]) {
    process.env.TZ = zone;
    seen.add(formatDayTime("2026-09-17T18:30:00.000Z"));
  }
  process.env.TZ = original;
  assert.deepEqual([...seen], ["Thu 6:30pm"]);
});

test("time bands follow the chips, with weekends winning", () => {
  assert.equal(bandOf("2026-09-18T09:00:00.000Z"), "mornings"); // Friday am
  assert.equal(bandOf("2026-09-17T18:30:00.000Z"), "evenings"); // Thursday pm
  assert.equal(bandOf("2026-09-19T10:00:00.000Z"), "weekends"); // Saturday am
  assert.equal(bandOf("2026-09-17T14:00:00.000Z"), null); // a weekday afternoon has no chip
});

test("a level is read only where a coach stated one", () => {
  assert.equal(levelOf({ level: "Advanced Plus (NTRP 4.5)" }), "4.5");
  assert.equal(levelOf({ level: "Intermediate (NTRP 3.5)" }), "3.5");
  assert.equal(levelOf({ level: "" }), null);
  assert.equal(levelOf({}), null);
  // The level is in the title, which we deliberately do not parse.
  assert.equal(levelOf({ title: "Liveball Intensive (2h, curated 3.5-4.0 group)", level: "" }), null);
});

test("the venue is named once, not twice", () => {
  assert.equal(
    venueOf("Culver City High School Tennis Court Culver City, CA 90230, USA", "Culver City"),
    "Culver City High School Tennis Court",
  );
  assert.equal(venueOf("Penmar Recreation Center, Venice, CA", "Venice"), "Penmar Recreation Center");
  assert.equal(venueOf("", "Venice"), null);
});

test("areas are matched from the address", () => {
  assert.deepEqual(areaOf("Culver City High School, Culver City, CA"), ["culver-city", "Culver City"]);
  assert.deepEqual(areaOf("Somewhere in Pasadena, CA"), [null, null]);
});

test("a real lesson becomes a card with nothing invented", () => {
  const [card] = buildPublicClasses([lesson2637]);

  assert.deepEqual(card, {
    t: "Culver City 4.5 Liveball",
    v: "Culver City High School Tennis Court",
    d: "Thu 6:30pm",
    c: "Paul Cochrane",
    p: "$42.50",
    lvl: "4.5",
    area: "culver-city",
    when: "evenings",
  });
});

test("a lesson missing what a card must state is dropped, not padded", () => {
  assert.equal(buildPublicClasses([{ ...lesson2637, metadata: {} }]).length, 0);
  assert.equal(buildPublicClasses([{ ...lesson2637, full_name: "" }]).length, 0);
  assert.equal(buildPublicClasses([{ ...lesson2637, start_date_time: null }]).length, 0);
  assert.equal(buildPublicClasses([{ ...lesson2637, location: "" }]).length, 0);
});

test("a class with no price says so rather than showing $0", () => {
  const [card] = buildPublicClasses([{ ...lesson2637, group_price_per_person: 0 }]);
  assert.equal(card.p, "See price");
});

// The five live divisions and one stale one, as the API returns them.
const leagueRows = [
  {
    name: "Men's 3.5 Fall Flex League",
    skill_band: "3.5",
    gender: "men",
    status: "active",
    start_date: "2026-09-15T00:00:00.000Z",
    end_date: "2026-12-15T00:00:00.000Z",
    deadline: "2026-09-20T00:00:00.000Z",
    cost_cents: 5999,
    total_players_allowed: 20,
    spots_remaining: 5,
    is_full: false,
  },
  {
    name: "Men's 4.0 Fall Flex League 2026",
    skill_band: "4.0",
    gender: "men",
    status: "active",
    start_date: "2026-09-05T00:00:00.000Z",
    end_date: "2026-11-30T00:00:00.000Z",
    deadline: "2026-09-15T00:00:00.000Z",
    cost_cents: 5999,
    total_players_allowed: 20,
    spots_remaining: 0,
    is_full: true,
  },
  {
    name: "Men's 4.0 Spring Flex League",
    skill_band: "4.0",
    gender: "men",
    status: "active",
    start_date: "2026-05-01T00:00:00.000Z",
    end_date: null,
    deadline: "2026-08-31T00:00:00.000Z",
    cost_cents: 0,
    total_players_allowed: 16,
    spots_remaining: 3,
    is_full: false,
  },
  {
    name: "Tennis Plan 4.5 Fall Flex League",
    skill_band: "4.5",
    gender: "mixed",
    status: "active",
    start_date: "2026-09-15T00:00:00.000Z",
    end_date: "2026-12-15T00:00:00.000Z",
    deadline: "2026-09-15T00:00:00.000Z",
    cost_cents: 500,
    total_players_allowed: 16,
    spots_remaining: 2,
    is_full: false,
  },
];

const today = new Date("2026-09-16T12:00:00.000Z");

test("only divisions someone can still join are published", () => {
  const names = buildPublicLeagues(leagueRows, today).map((item) => item.t);

  assert.deepEqual(names, ["Men's 3.5 Fall Flex League", "Tennis Plan 4.5 Fall Flex League"]);
});

test("a full division is withheld, because the page promises spots left", () => {
  const full = buildPublicLeagues(leagueRows, today).find((item) => item.t.includes("4.0 Fall"));
  assert.equal(full, undefined);
});

test("a season that has ended is withheld even though the API calls it active", () => {
  const spring = buildPublicLeagues(leagueRows, today).find((item) => item.t.includes("Spring"));
  assert.equal(spring, undefined);
});

test("the real price and roster are quoted, not a placeholder", () => {
  const [mens] = buildPublicLeagues(leagueRows, today);

  assert.equal(mens.n, "20 players · Sep-Dec · $59.99 · sign up by 09/20");
  assert.equal(mens.spots, 5);
  assert.equal(mens.div, "mens");
  assert.equal(mens.lvl, "3.5");
});

test("a deadline that has passed is not advertised", () => {
  const mixed = buildPublicLeagues(leagueRows, today).find((item) => item.t.startsWith("Tennis Plan"));

  assert.ok(!mixed.n.includes("sign up by"), mixed.n);
  assert.equal(mixed.n, "16 players · Sep-Dec · $5");
});

test("a mixed division is not forced into one of the two chips", () => {
  const mixed = buildPublicLeagues(leagueRows, today).find((item) => item.t.startsWith("Tennis Plan"));
  assert.equal(mixed.div, "any");
});

test("hand-typed venue strings are cleaned up", () => {
  // Real strings from production.
  assert.equal(venueOf("17005 Palisades Cir 17005 Palisades Cir, Pacific Palisades, CA", null), "17005 Palisades Cir");
  assert.equal(venueOf("Colorado Center Park Broadway &, 26th St, Santa Monica, CA", "Santa Monica"), "Colorado Center Park Broadway");
  assert.equal(venueOf("11938 Chaparal St, Los Angeles, CA 90049, USA", null), "11938 Chaparal St");
  // A genuine two-word-each venue is not mistaken for a doubled one.
  assert.equal(venueOf("Penmar Park Tennis Courts, Venice, CA", "Venice"), "Penmar Park Tennis Courts");
});

test("a weekly class is listed once, at its soonest date", () => {
  const weekly = (id, date) => ({
    id,
    start_date_time: `${date}T09:00:00.000Z`,
    full_name: "Paul Cochrane",
    group_price_per_person: 40,
    location: "11938 Chaparal St, Los Angeles, CA 90049, USA",
    metadata: { title: "Chaparal Friday liveball" },
  });

  // Same class, three consecutive Fridays. The card only says "Fri 9:00am",
  // so three rows would read as three identical listings.
  const cards = buildPublicClasses([
    weekly(2786, "2026-09-18"),
    weekly(2787, "2026-09-25"),
    weekly(2788, "2026-10-02"),
  ]);

  assert.equal(cards.length, 1);
  assert.equal(cards[0].d, "Fri 9:00am");
});

test("two different classes at the same hour both survive", () => {
  const at = (title, venue) => ({
    start_date_time: "2026-09-18T09:00:00.000Z",
    full_name: "Paul Cochrane",
    group_price_per_person: 40,
    location: `${venue}, Los Angeles, CA`,
    metadata: { title },
  });

  assert.equal(buildPublicClasses([at("Morning drills", "Penmar Park"), at("Cardio tennis", "Penmar Park")]).length, 2);
  assert.equal(buildPublicClasses([at("Morning drills", "Penmar Park"), at("Morning drills", "Stoner Park")]).length, 2);
});
