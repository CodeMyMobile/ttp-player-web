import assert from "node:assert/strict";
import test from "node:test";

import {
  findPlayersHref,
  homePlayerSuggestions,
  isNearLevel,
  reasonFor,
  searchRadiusMiles,
  type SuggestionViewer,
} from "./homePlayerSuggestions";
import { mapSuggestedPlayer, type SuggestedPlayerRecord } from "./suggestedPlayer";

let nextId = 1;
/** A player as Find Players maps them from the API. */
const player = (overrides: Partial<SuggestedPlayerRecord> = {}) =>
  mapSuggestedPlayer({
    userId: nextId++,
    full_name: `Player ${nextId}`,
    skillLevel: "3.5",
    availability: [],
    playerCourtLocations: ["Far Park"],
    distance_miles: 2,
    ...overrides,
  });

const viewer = (overrides: Partial<SuggestionViewer> = {}): SuggestionViewer => ({
  level: "3.5",
  availability: [],
  courts: ["Penmar Park"],
  ...overrides,
});

const idsOf = (result: ReturnType<typeof homePlayerSuggestions>) =>
  result.state === "suggestions" ? result.suggestions.map((s) => s.player.name) : [];

test("level is a hard gate of half a level either side", () => {
  assert.equal(isNearLevel("3.5", "3.0"), true);
  assert.equal(isNearLevel("3.5", "4.0"), true);
  assert.equal(isNearLevel("3.5", "2.5"), false);
  assert.equal(isNearLevel("3.5", "4.5"), false);
  assert.equal(isNearLevel("NTRP 3.5", "3.5"), true);
  // "4.5+" is 4.5 and up.
  assert.equal(isNearLevel("5.0", "4.5+"), true);
  assert.equal(isNearLevel("4.0", "4.5+"), true);
  assert.equal(isNearLevel("3.5", "4.5+"), false);
  // No level on either side is never a match.
  assert.equal(isNearLevel("3.5", "Unknown"), false);
  assert.equal(isNearLevel("3.5", ""), false);
  assert.equal(isNearLevel(null, "3.5"), false);

  const result = homePlayerSuggestions({
    players: [
      player({ full_name: "Low", skillLevel: "2.5" }),
      player({ full_name: "Under", skillLevel: "3.0" }),
      player({ full_name: "Same", skillLevel: "3.5" }),
      player({ full_name: "Over", skillLevel: "4.0" }),
      player({ full_name: "High", skillLevel: "4.5" }),
    ],
    viewer: viewer(),
  });
  assert.deepEqual(idsOf(result).sort(), ["Over", "Same", "Under"]);
});

test("never suggests a player with no level of their own", () => {
  const result = homePlayerSuggestions({
    players: [
      player({ full_name: "Rated A" }),
      player({ full_name: "Rated B" }),
      player({ full_name: "No level", skillLevel: "" }),
      player({ full_name: "Unknown", skillLevel: "Unknown" }),
      player({ full_name: "Prefer not", skillLevel: "Prefer not to say" }),
    ],
    viewer: viewer(),
  });
  assert.deepEqual(idsOf(result).sort(), ["Rated A", "Rated B"]);
});

test("scores shared court 3, availability 2, verified 1, photo 1, and breaks ties by distance", () => {
  const result = homePlayerSuggestions({
    players: [
      player({ full_name: "Photo", profile_picture: "https://x/p.jpg", distance_miles: 1 }),
      player({ full_name: "Court", playerCourtLocations: ["penmar park "], distance_miles: 9 }),
      player({ full_name: "Weekends", availability: ["Weekends"], distance_miles: 5 }),
      player({ full_name: "Verified far", isLevelConfirmed: true, distance_miles: 8 }),
      player({ full_name: "Verified near", isLevelConfirmed: true, distance_miles: 3 }),
      player({ full_name: "Nothing", distance_miles: 0.5 }),
    ],
    viewer: viewer({ availability: ["Weekends"] }),
  });
  assert.equal(result.state, "suggestions");
  assert.deepEqual(idsOf(result), ["Court", "Weekends", "Photo", "Verified near", "Verified far", "Nothing"]);
  if (result.state === "suggestions") {
    assert.deepEqual(result.suggestions.map((s) => s.score), [3, 2, 1, 1, 1, 0]);
  }
});

test("picks the reason chip in priority order", () => {
  const slots = (...names: string[]) => new Set(names.map((name) => name.toLowerCase()));
  assert.equal(
    reasonFor({ sameCourt: true, sharedSlots: slots("Weekends"), distanceMiles: 1 }).label,
    "Same home court",
  );
  assert.equal(
    reasonFor({ sameCourt: false, sharedSlots: slots("Weekdays AM", "Weekends"), distanceMiles: 1 }).label,
    "Both free weekends",
  );
  assert.equal(
    reasonFor({ sameCourt: false, sharedSlots: slots("Weekdays AM", "Weekday PM"), distanceMiles: 1 }).label,
    "Weekday mornings",
  );
  assert.equal(
    reasonFor({ sameCourt: false, sharedSlots: slots("Weekday PM"), distanceMiles: 1 }).label,
    "Weekday evenings",
  );
  assert.deepEqual(reasonFor({ sameCourt: false, sharedSlots: slots(), distanceMiles: 2.34 }), {
    type: "level",
    label: "Your level · 2.3 mi",
  });
  assert.equal(reasonFor({ sameCourt: false, sharedSlots: slots(), distanceMiles: null }).label, "Your level");
});

test("availability in the API's own words still overlaps", () => {
  // The API sends day names and longer labels; Find Players canonicalises them.
  const result = homePlayerSuggestions({
    players: [player({ full_name: "Sat", availability: ["Saturday"] }), player({ full_name: "Other" })],
    viewer: viewer({ availability: ["Weekends"] }),
  });
  assert.equal(result.state === "suggestions" && result.suggestions[0].reason.label, "Both free weekends");
});

test("hides the block with fewer than 2 players, after widening to 15 mi", () => {
  const one = homePlayerSuggestions({ players: [player({ distance_miles: 1 })], viewer: viewer() });
  assert.deepEqual(one, { state: "hidden", total: 1, radiusMiles: 15 });

  const none = homePlayerSuggestions({ players: [], viewer: viewer() });
  assert.equal(none.state, "hidden");
});

test("widens from 10 to 15 mi only when fewer than 2 qualify, and never widens the level", () => {
  const players = [
    player({ full_name: "Near", distance_miles: 4 }),
    player({ full_name: "Twelve", distance_miles: 12 }),
    player({ full_name: "Off level near", skillLevel: "4.5", distance_miles: 1 }),
    player({ full_name: "Too far", distance_miles: 16 }),
  ];
  const widened = homePlayerSuggestions({ players, viewer: viewer() });
  assert.equal(widened.state, "suggestions");
  assert.equal(widened.radiusMiles, 15);
  assert.deepEqual(idsOf(widened).sort(), ["Near", "Twelve"]);

  // Two within 10 mi: no widening, so the 12 mi player stays out.
  const enough = homePlayerSuggestions({
    players: [...players, player({ full_name: "Also near", distance_miles: 9.9 })],
    viewer: viewer(),
  });
  assert.equal(enough.radiusMiles, 10);
  assert.deepEqual(idsOf(enough).sort(), ["Also near", "Near"]);
});

test("without distance_miles from the API, players count only once widened to the searched radius", () => {
  const players = [player({ full_name: "A", distance_miles: undefined }), player({ full_name: "B", distance_miles: null })];
  const result = homePlayerSuggestions({ players, viewer: viewer() });
  assert.equal(result.state, "suggestions");
  assert.equal(result.radiusMiles, 15);
  assert.equal(result.state === "suggestions" && result.suggestions[0].reason.label, "Your level");
});

test("shows at most 8 but counts everyone who qualified", () => {
  const players = Array.from({ length: 11 }, () => player());
  const result = homePlayerSuggestions({ players, viewer: viewer() });
  assert.equal(result.state === "suggestions" && result.suggestions.length, 8);
  assert.equal(result.state === "suggestions" && result.total, 11);
});

test("a viewer with no level gets the prompt, with nearby players at any level, photos first", () => {
  const players = [
    player({ full_name: "No photo", skillLevel: "4.5" }),
    player({ full_name: "Photo", skillLevel: "", profile_picture: "https://x/p.jpg" }),
    player({ full_name: "Far", distance_miles: 30 }),
  ];
  for (const level of [null, "", "Unknown"]) {
    const result = homePlayerSuggestions({ players, viewer: viewer({ level }) });
    assert.equal(result.state, "noLevel");
    if (result.state === "noLevel") {
      assert.equal(result.nearbyCount, 2);
      assert.deepEqual(result.nearby.map((p) => p.name), ["Photo", "No photo"]);
    }
  }
});

test("setting a level turns the prompt into suggestions, from the same players", () => {
  // What happens on returning from the rating quiz: the same list, now with a level.
  const players = [player({ full_name: "A" }), player({ full_name: "B" }), player({ full_name: "C", skillLevel: "5.0" })];
  assert.equal(homePlayerSuggestions({ players, viewer: viewer({ level: null }) }).state, "noLevel");
  const after = homePlayerSuggestions({ players, viewer: viewer({ level: "3.5" }) });
  assert.equal(after.state, "suggestions");
  assert.deepEqual(idsOf(after).sort(), ["A", "B"]);
});

test("searches far enough for the widening in one call, and links Find Players with the same filters", () => {
  assert.equal(searchRadiusMiles(10), 15);
  assert.equal(searchRadiusMiles(20), 20);
  assert.equal(findPlayersHref(15), "/find-players?radius=15&level=near");
});
