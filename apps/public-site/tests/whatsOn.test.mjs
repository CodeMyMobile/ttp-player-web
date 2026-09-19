import assert from "node:assert/strict";
import { test } from "node:test";

import {
  areaOf,
  bandOf,
  buildExternalClasses,
  buildPublicClasses,
  buildPublicLeagues,
  dropPastClasses,
  utcInstantToVenueWallClock,
  venueNowKey,
  wallClockKey,
  classAreas,
  classSchema,
  formatDate,
  formatDayTime,
  levelOf,
  venueOf,
  venueOffsetIso,
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
    id: 2637,
    startDateTime: "2026-09-17T18:30:00.000Z",
    dateLabel: "Thu, Sep 17",
    occurrences: 1,
    externalUrl: null,
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
  // The card can say "3 dates" rather than pretending the other two do not exist.
  assert.equal(cards[0].occurrences, 3);
  assert.equal(cards[0].dateLabel, "Fri, Sep 18"); // the soonest, not the last
  assert.equal(cards[0].id, 2786);
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

test("schema.org startDate carries the venue's offset for that date", () => {
  // Search engines read startDate as an instant, so the floating clock needs an
  // offset — and it differs by date, since PDT and PST are an hour apart.
  assert.equal(venueOffsetIso("2026-09-17T18:30:00.000Z"), "2026-09-17T18:30:00-07:00"); // PDT
  assert.equal(venueOffsetIso("2026-12-10T18:30:00.000Z"), "2026-12-10T18:30:00-08:00"); // PST
  assert.equal(venueOffsetIso(null), null);
});

test("the date label reads from the venue clock", () => {
  assert.equal(formatDate("2026-09-17T18:30:00.000Z"), "Thu, Sep 17");
  assert.equal(formatDate("2026-10-02T09:00:00.000Z"), "Fri, Oct 2");
  assert.equal(formatDate("bad"), null);
});

test("areas are ordered by how many classes they hold, ties alphabetical", () => {
  const at = (area, title) => ({
    start_date_time: "2026-09-17T18:30:00.000Z",
    full_name: "Paul Cochrane",
    group_price_per_person: 40,
    location: `Some Court, ${area}, CA`,
    metadata: { title },
  });

  const classes = buildPublicClasses([
    at("Venice", "A"),
    at("Culver City", "B"),
    at("Culver City", "C"),
    at("Santa Monica", "D"),
    // No recognised area — belongs to no area page.
    { ...at("Pasadena", "E") },
  ]);

  assert.deepEqual(classAreas(classes), ["culver-city", "santa-monica", "venice"]);
});

test("structured data states only what we hold", () => {
  const [card] = buildPublicClasses([lesson2637]);
  const schema = classSchema(card);

  assert.equal(schema["@type"], "SportsEvent");
  assert.equal(schema.startDate, "2026-09-17T18:30:00-07:00");
  // Culver City is its own city, not Los Angeles.
  assert.equal(schema.location.address.addressLocality, "Culver City");
  assert.equal(schema.offers.price, "42.5");
  assert.equal(schema.offers.url, "https://app.thetennisplan.com/#/group-lessons/2637");
});

test("an unknown area leaves the locality out rather than guessing", () => {
  const [card] = buildPublicClasses([
    { ...lesson2637, location: "17005 Palisades Cir, Pacific Palisades, CA 90272, USA" },
  ]);

  assert.equal(card.area, null);
  assert.equal("addressLocality" in classSchema(card).location.address, false);
});

test("a class with no price emits no offer", () => {
  const [card] = buildPublicClasses([{ ...lesson2637, group_price_per_person: 0 }]);
  assert.equal("offers" in classSchema(card), false);
});


// ─── External lessons ─────────────────────────────────────────────────────

// Lesson 1296 as /api/admin/external-lessons actually returns it. Note the
// shape: title at the top level, coach under metadata, and no price field at
// all — the internal mapper looks for metadata.title and row.full_name, so it
// finds neither and drops the row.
const external1296 = {
  id: 1296,
  title: "Liveball: 4.5",
  level: "4.5",
  start_date_time: "2026-09-30T03:00:00.000Z",
  end_date_time: "2026-09-30T04:30:00.000Z",
  location: "Culver City Private Court, across from 6225 Canterbury Drive, Culver City, CA 90230",
  external_url: "https://momence.com/u/fortune-tennis-mJIDpV?class=liveball-4-5",
  metadata: { full_name: "Manny Fortune", coach_name: "Manny Fortune", description: "90 min. Price: $50." },
  status: 0,
};

test("the internal mapper cannot read an external row", () => {
  // The reason these never appeared even before the fetch existed: the two
  // shapes differ in exactly the fields buildPublicClasses guards on.
  assert.equal(buildPublicClasses([external1296]).length, 0);
});

test("an external class maps to a card, priced as See price", () => {
  const [card] = buildExternalClasses([external1296]);
  assert.equal(card.t, "Liveball: 4.5");
  assert.equal(card.c, "Manny Fortune");
  assert.equal(card.v, "Culver City Private Court");
  assert.equal(card.lvl, "4.5");
  assert.equal(card.area, "culver-city");
  // No price column exists. "Price: $50." lives in prose inside the
  // description, and parsing that would publish a guess.
  assert.equal(card.p, "See price");
  assert.equal(card.externalUrl, "https://momence.com/u/fortune-tennis-mJIDpV?class=liveball-4-5");
});

test("an external card never claims an in-app id", () => {
  // `id` addresses our own app's route; an external id would link to a class
  // the app does not have.
  const [card] = buildExternalClasses([external1296]);
  assert.equal(card.id, null);
});

test("an external start is a real UTC instant and gets converted", () => {
  // The opposite convention from our own lessons, whose Z is decorative. The
  // row's own booking URL is the proof: date=2026-09-29&time=2000. Reading it
  // literally would advertise Wed 3:00am for a Tuesday evening class.
  const [card] = buildExternalClasses([external1296]);
  assert.equal(card.d, "Tue 8:00pm");
  assert.equal(card.dateLabel, "Tue, Sep 29");
  assert.equal(card.startDateTime, "2026-09-29T20:00:00.000Z");
});

test("the conversion matches what each provider's own booking link says", () => {
  // Sampled from live rows, each checked against its external_url.
  assert.equal(utcInstantToVenueWallClock("2026-09-30T03:00:00.000Z"), "2026-09-29T20:00:00.000Z");
  assert.equal(utcInstantToVenueWallClock("2026-09-27T20:30:00.000Z"), "2026-09-27T13:30:00.000Z");
  assert.equal(utcInstantToVenueWallClock("2026-09-26T16:00:00.000Z"), "2026-09-26T09:00:00.000Z");
  assert.equal(utcInstantToVenueWallClock("nonsense"), null);
  assert.equal(utcInstantToVenueWallClock(null), null);
});

test("a winter instant converts on standard time, not a fixed offset", () => {
  // PST is UTC-8, so a hardcoded -7 would put this an hour out.
  assert.equal(utcInstantToVenueWallClock("2027-01-15T03:00:00.000Z"), "2027-01-14T19:00:00.000Z");
});

test("an external class with nothing to book is not a listing", () => {
  assert.equal(buildExternalClasses([{ ...external1296, external_url: "" }]).length, 0);
  assert.equal(buildExternalClasses([{ ...external1296, title: "" }]).length, 0);
  assert.equal(buildExternalClasses([{ ...external1296, metadata: {} }]).length, 0);
  assert.equal(buildExternalClasses([{ ...external1296, location: "" }]).length, 0);
  assert.equal(buildExternalClasses([{ ...external1296, start_date_time: null }]).length, 0);
});

test("repeat external dates collapse to one card with a count", () => {
  const cards = buildExternalClasses([
    external1296,
    { ...external1296, id: 1297, start_date_time: "2026-10-07T03:00:00.000Z" },
    { ...external1296, id: 1298, start_date_time: "2026-10-14T03:00:00.000Z" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].occurrences, 3);
});

// ─── Past classes ─────────────────────────────────────────────────────────

test("a class that has already started is dropped", () => {
  // These pages are a build-time snapshot, so nothing re-checks after deploy.
  // This is the backstop that stops a fresh build shipping a past class.
  const [past] = buildExternalClasses([external1296]);
  const [future] = buildExternalClasses([{ ...external1296, start_date_time: "2026-12-01T03:00:00.000Z" }]);
  const now = new Date("2026-10-01T12:00:00Z");

  const kept = dropPastClasses([past, future], now);
  assert.deepEqual(kept.map((item) => item.startDateTime), ["2026-11-30T19:00:00.000Z"]);
});

test("the cutoff is the venue's clock, not the build machine's", () => {
  // The class is Tue Sep 29, 8:00pm at the court. At 2026-09-30T02:00Z it is
  // still only 7:00pm there, so it has not started.
  const [card] = buildExternalClasses([external1296]);
  assert.equal(dropPastClasses([card], new Date("2026-09-30T02:00:00Z")).length, 1);
  // An hour later on the venue clock it has.
  assert.equal(dropPastClasses([card], new Date("2026-09-30T03:30:00Z")).length, 0);
});

test("an unreadable start is kept rather than silently binned", () => {
  const card = { ...buildExternalClasses([external1296])[0], startDateTime: null };
  assert.equal(dropPastClasses([card], new Date("2027-01-01T00:00:00Z")).length, 1);
});

test("wall clock keys sort without ever building a Date from the string", () => {
  assert.equal(wallClockKey("2026-09-30T03:00:00.000Z"), 202609300300);
  assert.equal(wallClockKey("nonsense"), null);
  assert.ok(wallClockKey("2026-09-30T03:00:00.000Z") < wallClockKey("2026-09-30T18:30:00.000Z"));
  // Midnight in the venue zone reads as hour 0, matching the backend cutoff.
  assert.ok(venueNowKey(new Date("2026-09-30T07:00:00Z")) % 10000 < 100);
});
