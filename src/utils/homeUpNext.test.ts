import assert from "node:assert/strict";
import test from "node:test";

import type { WeekDayItems, WeekItem } from "../features/myWeek/types";
import { buildUpNext, directionsUrl, matchLineup, playersLabel } from "./homeUpNext";

const at = (dayKey: string, hour: number) => new Date(`${dayKey}T${String(hour).padStart(2, "0")}:00:00`).getTime();

const item = (over: Partial<WeekItem> & { dayKey: string; hour?: number }): WeekItem => {
  const { hour = 12, ...rest } = over;
  return {
    id: "match:1",
    source: "match",
    type: "match",
    state: "booked",
    needsResponse: false,
    time: { kind: "fixed", startsAt: at(over.dayKey, hour) },
    title: "Singles match",
    subtitle: "Mar Vista Recreation Center, 11430 Woodbine St, Los Angeles, CA 90066, USA",
    people: [],
    reason: null,
    actions: ["open"],
    href: "/matches/1",
    raw: null,
    ...rest,
  };
};

const week = (items: WeekItem[]): WeekDayItems[] =>
  ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((dayKey) => ({
    dayKey,
    items: items.filter((entry) => entry.dayKey === dayKey),
    load: 0,
    hasWaiting: false,
  }));

const MORNING = at("2026-11-13", 8);

test("the next booking is the hero, the rest of the week follows soonest first", () => {
  const { hero, rest } = buildUpNext(
    week([
      item({ id: "groupLesson:5", source: "groupLesson", type: "lesson", dayKey: "2026-11-15", hour: 9, title: "Liveball" }),
      item({ id: "match:1", dayKey: "2026-11-13", hour: 12 }),
      item({ id: "lesson:7", source: "lesson", type: "lesson", dayKey: "2026-11-14", hour: 10, title: "Lesson with Sam" }),
    ]),
    MORNING,
  );
  assert.equal(hero?.item.id, "match:1");
  assert.equal(hero?.tag, "Match play");
  assert.match(hero?.when ?? "", /^Today · 12:00\sPM$/);
  assert.equal(hero?.venue, "Mar Vista Recreation Center");
  assert.deepEqual(rest.map((entry) => entry.item.id), ["lesson:7", "groupLesson:5"]);
  assert.match(rest[0].when, /^Tomorrow · /);
  assert.equal(rest[1].tag, "Group lesson");
  assert.equal(rest[1].dayShort, "SUN");
  assert.equal(rest[1].dayNumber, 15);
});

test("invites, suggestions and things already over are not up next", () => {
  const { hero, rest } = buildUpNext(
    week([
      item({ id: "invite:2", source: "invite", state: "pending", dayKey: "2026-11-13", hour: 18 }),
      item({ id: "openMatch:3", source: "openMatch", state: "suggested", dayKey: "2026-11-13", hour: 18 }),
      item({ id: "match:4", dayKey: "2026-11-13", hour: 7 }),
    ]),
    MORNING,
  );
  assert.equal(hero, null);
  assert.deepEqual(rest, []);
});

test("directions only when there's a venue", () => {
  assert.equal(directionsUrl(null), null);
  assert.equal(directionsUrl("  "), null);
  assert.equal(directionsUrl("Penmar Park"), "https://www.google.com/maps/search/?api=1&query=Penmar%20Park");
});

const person = (name: string) => ({ id: name, name, photoUrl: null });

test("a match's hero says who's in and how many spots are left", () => {
  const { hero } = buildUpNext(
    week([
      item({
        dayKey: "2026-11-13",
        hour: 18,
        subtitle: "doubles",
        people: [person("Alex Kim"), person("Sam Lee")],
        raw: { id: 1, match_format: "doubles", player_limit: 4, location_text: "Penmar Park, Venice, CA" },
      }),
    ]),
    MORNING,
  );
  assert.equal(hero?.playersLabel, "With Alex and Sam");
  assert.equal(hero?.lineup, "Doubles · 3 of 4 in · 1 spot open");
  // A friendly match's subtitle is its format: the venue and directions use its address.
  assert.equal(hero?.directionsUrl, directionsUrl("Penmar Park, Venice, CA"));
  assert.equal(hero?.title, "Match at Penmar Park");
  assert.equal(hero?.venue, null, "the title already names it");
});

test("players label and lineup", () => {
  assert.equal(playersLabel([]), "No one else is in yet");
  assert.equal(playersLabel([person("Alex Kim")]), "With Alex Kim");
  assert.equal(playersLabel([person("Alex Kim"), person("Sam Lee"), person("Jo Park"), person("Ty Ng")]), "With Alex, Sam +2");
  assert.equal(matchLineup({ match_format: "singles", player_limit: 2 }, [person("Alex Kim")]), "Singles · 2 of 2 in");
  assert.equal(matchLineup({}, []), null);
  assert.equal(matchLineup({ is_league_match: true, match_format: "singles" }, []), null);
});

test("lessons get no players line", () => {
  const { hero } = buildUpNext(
    week([item({ id: "lesson:7", source: "lesson", type: "lesson", dayKey: "2026-11-13", hour: 18, people: [person("Alex Kim")] })]),
    MORNING,
  );
  assert.equal(hero?.playersLabel, null);
  assert.deepEqual(hero?.players, []);
});
