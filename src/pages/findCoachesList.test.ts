import assert from "node:assert/strict";
import test from "node:test";

import {
  coachMatchesChip,
  coachMatchesChips,
  countWithinRadius,
  findDistanceDividerIndex,
  isThinCoachProfile,
  sortCoaches,
} from "./findCoachesList";

/**
 * The card model as the page builds it — every specialty, level and format has already
 * been through normalizeDisplayLabel, which title-cases. That is why these fixtures are
 * capitalised while the API returns lowercase.
 */
const coach = (over: Record<string, unknown> = {}) => ({
  specialties: ["Forehand", "Juniors"],
  levels: ["Beginner", "Intermediate"],
  formats: ["Private", "Group"],
  distanceMiles: 1,
  hourlyRateValue: 100,
  studentCount: 10,
  availabilityWindows: ["Weekday Mornings"],
  ...over,
});

test("chips match the fields the API actually populates", () => {
  assert.equal(coachMatchesChip(coach(), "juniors"), true);
  assert.equal(coachMatchesChip(coach(), "beginners"), true);
  assert.equal(coachMatchesChip(coach(), "groups"), true);
});

test("chips are case-insensitive — the page title-cases what the API sends lowercase", () => {
  // This is the break this file exists to catch. The API returns "juniors"/"beginner"/
  // "group"; normalizeDisplayLabel turns them into "Juniors"/"Beginner"/"Group". A
  // case-sensitive match would return an empty list for every chip, silently.
  const raw = coach({ specialties: ["juniors"], levels: ["beginner"], formats: ["group"] });
  assert.equal(coachMatchesChip(raw, "juniors"), true);
  assert.equal(coachMatchesChip(raw, "beginners"), true);
  assert.equal(coachMatchesChip(raw, "groups"), true);
});

test("Groups matches clinics as well as group", () => {
  assert.equal(coachMatchesChip(coach({ formats: ["Clinics"] }), "groups"), true);
  assert.equal(coachMatchesChip(coach({ formats: ["Private", "Semi"] }), "groups"), false);
});

test("each chip reads only its own field", () => {
  // A coach who teaches juniors is not thereby a Beginners coach, and vice versa. If the
  // vocabulary shifts and a value lands in the wrong array, this catches it.
  assert.equal(coachMatchesChip(coach({ specialties: [], levels: ["Beginner"] }), "juniors"), false);
  assert.equal(coachMatchesChip(coach({ levels: [], specialties: ["Juniors"] }), "beginners"), false);
  assert.equal(coachMatchesChip(coach({ formats: [], specialties: ["Juniors"] }), "groups"), false);
});

test("a coach missing the field entirely does not match", () => {
  assert.equal(coachMatchesChip({}, "juniors"), false);
  assert.equal(coachMatchesChip({ specialties: [] }, "juniors"), false);
});

test("chips are AND, and an empty selection matches everyone", () => {
  const juniorsOnly = coach({ specialties: ["Juniors"], levels: [], formats: [] });
  assert.equal(coachMatchesChips(juniorsOnly, []), true);
  assert.equal(coachMatchesChips(juniorsOnly, ["juniors"]), true);
  assert.equal(coachMatchesChips(juniorsOnly, ["juniors", "beginners"]), false);
});

test("sorts nearest, cheapest and most students", () => {
  const list = [
    coach({ specialties: ["a"], distanceMiles: 5, hourlyRateValue: 80, studentCount: 5 }),
    coach({ specialties: ["b"], distanceMiles: 1, hourlyRateValue: 200, studentCount: 40 }),
    coach({ specialties: ["c"], distanceMiles: 3, hourlyRateValue: 120, studentCount: 20 }),
  ];
  const spec = (rows: ReturnType<typeof coach>[]) => rows.map((row) => row.specialties[0]);

  assert.deepEqual(spec(sortCoaches(list, "nearest")), ["b", "c", "a"]);
  assert.deepEqual(spec(sortCoaches(list, "price-low")), ["a", "c", "b"]);
  assert.deepEqual(spec(sortCoaches(list, "students-high")), ["b", "c", "a"]);
});

test("missing values sort last, not first", () => {
  // A null distance must not read as zero miles and take the top slot.
  const list = [
    coach({ specialties: ["known"], distanceMiles: 9 }),
    coach({ specialties: ["unknown"], distanceMiles: null }),
  ];
  assert.deepEqual(
    sortCoaches(list, "nearest").map((row) => row.specialties[0]),
    ["known", "unknown"],
  );
});

test("thin profiles sort last under every order", () => {
  const thin = coach({ specialties: [], availabilityWindows: [], distanceMiles: 0.1, hourlyRateValue: 1, studentCount: 999 });
  const full = coach({ specialties: ["Forehand"], distanceMiles: 8, hourlyRateValue: 300, studentCount: 1 });

  for (const sort of ["nearest", "price-low", "students-high"] as const) {
    const [first] = sortCoaches([thin, full], sort);
    assert.equal(first.specialties[0], "Forehand", `thin profile led under ${sort}`);
  }
});

test("thin means no availability AND no specialties, not a missing photo", () => {
  assert.equal(isThinCoachProfile({ specialties: [], availabilityWindows: [] }), true);
  assert.equal(isThinCoachProfile({ specialties: ["Serve"], availabilityWindows: [] }), false);
  assert.equal(isThinCoachProfile({ specialties: [], availabilityWindows: ["Weekends"] }), false);
});

test("the divider lands before the first coach outside the radius", () => {
  const list = [
    coach({ distanceMiles: 1 }),
    coach({ distanceMiles: 4 }),
    coach({ distanceMiles: 7 }),
  ];
  assert.equal(findDistanceDividerIndex(list, { sort: "nearest", radiusMiles: 5 }), 2);
});

test("no divider when everything is inside the radius, or under another sort", () => {
  const list = [coach({ distanceMiles: 1 }), coach({ distanceMiles: 2 })];
  assert.equal(findDistanceDividerIndex(list, { sort: "nearest", radiusMiles: 5 }), -1);
  assert.equal(
    findDistanceDividerIndex([coach({ distanceMiles: 9 })], { sort: "price-low", radiusMiles: 5 }),
    -1,
  );
});

test("counts how many results are inside the radius", () => {
  const list = [
    coach({ distanceMiles: 1 }),
    coach({ distanceMiles: 5 }),
    coach({ distanceMiles: 6 }),
    coach({ distanceMiles: null }),
  ];
  // Exactly on the radius counts as inside; unknown distance does not.
  assert.equal(countWithinRadius(list, 5), 2);
});
