import assert from "node:assert/strict";
import test from "node:test";

import {
  COACH_CHIPS,
  type CoachChipKey,
  abbreviateVenueLabel,
  coachMatchesChip,
  countSessionsThisWeek,
  coachMatchesChips,
  countWithinRadius,
  findDistanceDividerIndex,
  formatAvailabilityPhrase,
  formatLevelsPill,
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
  assert.equal(coachMatchesChip(coach(), "beginner"), true);
  assert.equal(coachMatchesChip(coach(), "groups"), true);
});

test("chips are case-insensitive — the page title-cases what the API sends lowercase", () => {
  // This is the break this file exists to catch. The API returns "juniors"/"beginner"/
  // "group"; normalizeDisplayLabel turns them into "Juniors"/"Beginner"/"Group". A
  // case-sensitive match would return an empty list for every chip, silently.
  const raw = coach({ specialties: ["juniors"], levels: ["beginner"], formats: ["group"] });
  assert.equal(coachMatchesChip(raw, "juniors"), true);
  assert.equal(coachMatchesChip(raw, "beginner"), true);
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
  assert.equal(coachMatchesChip(coach({ levels: [], specialties: ["Juniors"] }), "beginner"), false);
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
  assert.equal(coachMatchesChips(juniorsOnly, ["juniors", "beginner"]), false);
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

test("availability caps at two day parts and counts the rest", () => {
  // The real three-part case from the roster: seven coaches publish three day parts.
  assert.equal(
    formatAvailabilityPhrase(["Weekends", "Weekday Mornings", "Weekday Evenings"]),
    "Weekends, weekday mornings +1",
  );
  // One and two parts are unchanged — there is nothing to hide, so no "+0".
  assert.equal(formatAvailabilityPhrase(["Weekday Mornings"]), "Weekday mornings");
  assert.equal(
    formatAvailabilityPhrase(["Weekday Mornings", "Weekends"]),
    "Weekday mornings, weekends",
  );
});

test("availability is sentence case, not title case", () => {
  // The API sends "Weekday Mornings"; mid-phrase it should read as prose.
  assert.equal(formatAvailabilityPhrase(["Weekday Afternoons", "Weekends"]), "Weekday afternoons, weekends");
});

test("availability tolerates empty, blank and missing input", () => {
  assert.equal(formatAvailabilityPhrase(undefined), "");
  assert.equal(formatAvailabilityPhrase([]), "");
  assert.equal(formatAvailabilityPhrase(["  ", ""]), "");
  // Blanks are dropped before the cap, so they never inflate the "+N".
  assert.equal(formatAvailabilityPhrase(["Weekends", "  ", "Weekday Mornings"]), "Weekends, weekday mornings");
});

test("venue labels shorten the two long facility words in the roster", () => {
  assert.equal(abbreviateVenueLabel("Penmar Recreation Center"), "Penmar Rec Center");
  assert.equal(abbreviateVenueLabel("Culver City High School"), "Culver City HS");
  // Untouched: abbreviating these would make the venue harder to recognise on arrival.
  assert.equal(abbreviateVenueLabel("Cheviot Hills Tennis Center"), "Cheviot Hills Tennis Center");
  assert.equal(abbreviateVenueLabel("Christine Emerson Reed Park"), "Christine Emerson Reed Park");
  assert.equal(abbreviateVenueLabel(null), "");
});

test("the levels pill is suppressed when a coach takes the whole skill ladder", () => {
  // 13 of the 15 coaches who publish levels are one of these two shapes, so the pill
  // was repeating "everyone" down most of the list.
  assert.equal(formatLevelsPill(["advanced", "beginner", "competitive", "intermediate"]), null);
  assert.equal(formatLevelsPill(["advanced", "beginner", "intermediate"]), null);
});

test("the levels pill survives when the range is actually narrow", () => {
  // Title case, because the page title-cases the API's lowercase values before the card
  // sees them. The pill echoes what it is given; only the suppression test below is
  // case-insensitive.
  assert.equal(
    formatLevelsPill(["Beginner", "Competitive", "Intermediate"]),
    "Levels Beginner, Competitive, Intermediate",
  );
  assert.equal(formatLevelsPill(["Beginner", "Intermediate"]), "Levels Beginner, Intermediate");
  // `competitive` is a fourth API value but not a rung on the ladder, so it neither
  // completes the set nor suppresses on its own.
  assert.equal(formatLevelsPill(["Advanced", "Beginner", "Competitive"]), "Levels Advanced, Beginner, Competitive");
  assert.equal(formatLevelsPill([]), null);
});

test("suppression does not depend on the casing it is handed", () => {
  // Raw API casing (lowercase) and page casing (title) must suppress alike, so the rule
  // cannot start firing or stop firing on a change of call site.
  assert.equal(formatLevelsPill(["beginner", "intermediate", "advanced"]), null);
  assert.equal(formatLevelsPill(["Beginner", "Intermediate", "Advanced"]), null);
});

test("numeric levels still collapse to a range", () => {
  assert.equal(formatLevelsPill(["3.0", "4.5"]), "Levels 3–4.5");
});

test('"weekly" group sessions means this week, not every upcoming one', () => {
  // Artur Castro's real roster: one 10:00 Saturday class repeating for eleven weeks. The
  // card said 11; the group-lessons page, which bounds to the week, showed 1.
  const saturdays = [
    "2026-09-12T10:00:00.000Z", "2026-09-19T10:00:00.000Z", "2026-09-26T10:00:00.000Z",
    "2026-10-03T10:00:00.000Z", "2026-10-10T10:00:00.000Z", "2026-10-17T10:00:00.000Z",
    "2026-10-24T10:00:00.000Z", "2026-10-31T10:00:00.000Z", "2026-11-07T10:00:00.000Z",
    "2026-11-14T10:00:00.000Z", "2026-11-21T10:00:00.000Z",
  ];
  assert.equal(saturdays.length, 11);
  assert.equal(countSessionsThisWeek(saturdays, "2026-09-06"), 1);
});

test("the session window includes today and the seventh day", () => {
  const days = [
    "2026-09-05T10:00:00.000Z", // yesterday
    "2026-09-06T10:00:00.000Z", // today
    "2026-09-12T10:00:00.000Z", // seventh day
    "2026-09-13T10:00:00.000Z", // eighth
  ];
  assert.equal(countSessionsThisWeek(days, "2026-09-06"), 2);
});

test("session counting crosses a month boundary", () => {
  // Naive slicing that compares only day-of-month would drop these.
  const days = ["2026-09-30T10:00:00.000Z", "2026-10-01T10:00:00.000Z"];
  assert.equal(countSessionsThisWeek(days, "2026-09-28"), 2);
});

test("session counting ignores junk and missing timestamps", () => {
  assert.equal(countSessionsThisWeek([null, undefined, "", "not-a-date"], "2026-09-06"), 0);
  assert.equal(countSessionsThisWeek(["2026-09-07T10:00:00.000Z"], ""), 0);
});

// --- level chips -------------------------------------------------------------

test("each level chip matches only its own level", () => {
  const c = (levels: string[]) => ({ levels, specialties: [], formats: [] });
  assert.equal(coachMatchesChip(c(["Intermediate"]), "intermediate"), true);
  assert.equal(coachMatchesChip(c(["Intermediate"]), "advanced"), false);
  assert.equal(coachMatchesChip(c(["Competitive"]), "competitive"), true);
  assert.equal(coachMatchesChip(c(["Advanced"]), "advanced"), true);
  // The API sends lowercase and the page title-cases it; both must match.
  assert.equal(coachMatchesChip(c(["advanced"]), "advanced"), true);
});

test("level chips combine with AND, like every other chip", () => {
  const both = { levels: ["Beginner", "Advanced"], specialties: [], formats: [] };
  const onlyBeginner = { levels: ["Beginner"], specialties: [], formats: [] };
  assert.equal(coachMatchesChips(both, ["beginner", "advanced"]), true);
  // Selecting two levels asks for a coach who teaches both, not either. With this
  // roster that is nearly the same set, but the semantics are worth pinning down.
  assert.equal(coachMatchesChips(onlyBeginner, ["beginner", "advanced"]), false);
});

test("a coach who publishes no levels matches no level chip", () => {
  // Half the roster is in this position today. They are excluded by any level chip,
  // which is the behaviour to expect until the coach data is filled in.
  const blank = { levels: [], specialties: ["Juniors"], formats: ["Group"] };
  for (const chip of ["beginner", "intermediate", "advanced", "competitive"] as const) {
    assert.equal(coachMatchesChip(blank, chip), false);
  }
  assert.equal(coachMatchesChip(blank, "juniors"), true);
});

test("an unrecognised chip key does not empty the list", () => {
  // A stale key from an old link must not AND everything away with no explanation.
  const anyone = { levels: [], specialties: [], formats: [] };
  assert.equal(coachMatchesChip(anyone, "no-such-chip" as unknown as CoachChipKey), true);
  assert.equal(coachMatchesChips(anyone, ["no-such-chip" as unknown as CoachChipKey]), true);
});

test("the chip row is levels in skill order, then the other two", () => {
  assert.deepEqual(
    COACH_CHIPS.map((chip) => chip.key),
    ["beginner", "intermediate", "advanced", "competitive", "juniors", "groups"],
  );
});
