import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCircleRows, initialsOf, peopleLabel, priceLabel, whenWhere } from "./homeCircle.ts";

const person = (id, name, extra = {}) => ({ id, full_name: name, profile_picture: null, is_host: false, ...extra });

test("a match hosted by someone I know reads as them looking to hit", () => {
  const [row] = buildCircleRows({
    matches: [
      {
        match_id: 10,
        when_label: "Tue, Nov 3 · 9:00 AM",
        location: "Penmar Recreation Center",
        format: "Singles",
        spots_open: 1,
        host: { id: 2, full_name: "Casey Morgan" },
        people: [person(2, "Casey Morgan", { is_host: true, profile_picture: "https://x/casey.jpg" })],
      },
    ],
  });
  assert.deepEqual(row, {
    key: "match-10",
    kind: "match",
    eyebrow: "Looking to hit",
    title: "Casey Morgan",
    when: "Tue, Nov 3 · 9:00 AM at Penmar Recreation Center",
    detail: "Singles · 1 spot open",
    chip: null,
    avatarUrl: "https://x/casey.jpg",
    initials: "CM",
    href: "/matches/10",
    cta: "View",
  });
});

test("when someone I know joined another player's match, it says whose match it is", () => {
  const [row] = buildCircleRows({
    matches: [
      {
        match_id: 11,
        when_label: "Thu, Nov 5 · 9:00 AM",
        location: null,
        format: "Doubles",
        spots_open: 2,
        host: { id: 5, full_name: "Jordan Lee" },
        people: [person(3, "Alex Rivera")],
      },
    ],
  });
  assert.equal(row.eyebrow, "Needs players");
  assert.equal(row.title, "Alex Rivera");
  assert.equal(row.when, "Thu, Nov 5 · 9:00 AM");
  assert.equal(row.detail, "Doubles · 2 spots open · Hosted by Jordan Lee");
});

test("a class from my coach shows the coach, price and spots, and only claims my level when known", () => {
  const rows = buildCircleRows({
    group_lessons: [
      {
        lesson_id: 30,
        title: "3.5-4.0 Liveball",
        coach_name: "Sam Monroe",
        coach_picture: null,
        location: "Penmar Park",
        when_label: "Mon, Nov 2 · 11:00 AM",
        price_per_person: 35,
        spots_left: 3,
        at_your_level: true,
      },
      {
        lesson_id: 31,
        title: "",
        coach_name: "Sam Monroe",
        coach_picture: null,
        location: null,
        when_label: null,
        price_per_person: null,
        spots_left: null,
        at_your_level: false,
      },
    ],
  });
  assert.equal(rows[0].eyebrow, "From your coach");
  assert.equal(rows[0].title, "3.5-4.0 Liveball");
  assert.equal(rows[0].when, "Mon, Nov 2 · 11:00 AM at Penmar Park");
  assert.equal(rows[0].detail, "With Sam Monroe · $35 · 3 spots left");
  assert.equal(rows[0].chip, "At your level");
  assert.equal(rows[0].href, "/group-lessons/30");
  assert.equal(rows[0].initials, "SM");

  // No price is not "free", and no level is not "at your level".
  assert.equal(rows[1].title, "Group lesson");
  assert.equal(rows[1].when, null);
  assert.equal(rows[1].detail, "With Sam Monroe");
  assert.equal(rows[1].chip, null);
});

test("matches come before classes", () => {
  const rows = buildCircleRows({
    group_lessons: [{ lesson_id: 1, title: "Drills", coach_name: "Sam", at_your_level: false }],
    matches: [{ match_id: 2, host: null, people: [person(1, "Casey", { is_host: true })] }],
  });
  assert.deepEqual(rows.map((row) => row.key), ["match-2", "class-1"]);
});

test("nothing to show for an empty or broken response", () => {
  assert.deepEqual(buildCircleRows(null), []);
  assert.deepEqual(buildCircleRows({}), []);
  assert.deepEqual(buildCircleRows({ matches: "nope" }), []);
});

test("labels", () => {
  assert.equal(peopleLabel([person(1, "Casey Morgan"), person(2, "Alex Rivera")]), "Casey Morgan and Alex Rivera");
  assert.equal(peopleLabel([person(1, "Casey"), person(2, "Alex"), person(3, "Sam")]), "Casey and 2 others");
  assert.equal(peopleLabel([]), "Someone you know");
  assert.equal(initialsOf("  casey   morgan smith "), "CM");
  assert.equal(initialsOf(null), "");
  assert.equal(priceLabel(37.5), "$37.50");
  assert.equal(priceLabel("40"), "$40");
  assert.equal(priceLabel(0), null);
  assert.equal(whenWhere("", "Penmar"), "Penmar");
});
