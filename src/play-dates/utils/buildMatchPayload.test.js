import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMatchPayload,
  buildMatchPayloadFromCard,
  normalizeFormat,
} from "./buildMatchPayload.js";
import { combineDateAndTimeToIso } from "./datetime.js";

// These fixtures pin buildMatchPayload to the exact payload the legacy
// single-match flow assembles in MatchCreatorFlow.jsx `handlePublish`
// (lines 815-849). start_date_time is asserted via the shared util rather than a
// hardcoded ISO literal so the test is timezone-independent.

const DATE = "2026-06-20";
const TIME = "18:00";
const expectedIso = combineDateAndTimeToIso(DATE, TIME);

const baseCard = () => ({
  date: DATE,
  startTime: TIME,
  duration: "2",
  location: "Penmar Recreation Center",
  latitude: 33.99,
  longitude: -118.46,
  totalPlayers: 4,
  format: "Doubles",
  notes: "",
  skillLevel: "4.0",
  skillLevelMin: "3.0",
  skillLevelMax: "4.0",
  gender: "Any",
  balls: "Host provides",
  verifiedOnly: false,
  listingVisibility: "listed",
});

test("open + listed (broadcast), fixed format, my-level → matches legacy payload", () => {
  const payload = buildMatchPayload(baseCard(), { type: "open" });
  assert.deepEqual(payload, {
    status: "upcoming",
    match_type: "open",
    start_date_time: expectedIso,
    durationMinutes: 120,
    duration_minutes: 120,
    location_text: "Penmar Recreation Center",
    latitude: 33.99,
    longitude: -118.46,
    player_limit: 4,
    match_format: "Doubles",
    notes: undefined,
    skill_level_min: "3.0",
    skill_level_max: "4.0",
    gender: "Any",
    category: "Any",
    balls: "Host provides",
    verifiedOnly: false,
    verified_only: false,
    hidden: false,
    is_hidden: false,
    listing_visibility: "listed",
  });
});

test("open + link_only (keep-on-profile/hidden) adds hidden visibility fields", () => {
  const card = { ...baseCard(), listingVisibility: "link_only" };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.hidden, true);
  assert.equal(payload.is_hidden, true);
  assert.equal(payload.listing_visibility, "link_only");
  assert.equal(payload.visibility, "hidden");
  assert.equal(payload.match_visibility, "hidden");
});

test("private payload omits all open-only fields", () => {
  const payload = buildMatchPayload(baseCard(), { type: "private" });
  assert.deepEqual(payload, {
    status: "upcoming",
    match_type: "private",
    start_date_time: expectedIso,
    durationMinutes: 120,
    duration_minutes: 120,
    location_text: "Penmar Recreation Center",
    latitude: 33.99,
    longitude: -118.46,
    player_limit: 4,
    match_format: "Doubles",
    notes: undefined,
  });
  for (const key of [
    "skill_level_min",
    "gender",
    "category",
    "balls",
    "verified_only",
    "listing_visibility",
  ]) {
    assert.equal(key in payload, false, `private payload should not include ${key}`);
  }
});

test("custom range uses skillLevelMin/Max verbatim", () => {
  const card = { ...baseCard(), skillLevelMin: "3.5", skillLevelMax: "4.5+" };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.skill_level_min, "3.5");
  assert.equal(payload.skill_level_max, "4.5+");
});

test("variable format with non-default count and 'Round-robin' label maps + carries", () => {
  const card = { ...baseCard(), format: "Round-robin", totalPlayers: 6, duration: "1.5" };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.match_format, "Round Robin");
  assert.equal(payload.player_limit, 6);
  assert.equal(payload.durationMinutes, 90);
  assert.equal(payload.duration_minutes, 90);
});

test("notes passthrough and undefined coordinate omission", () => {
  const card = { ...baseCard(), notes: "bring water", latitude: null, longitude: null };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.notes, "bring water");
  assert.equal(payload.latitude, undefined);
  assert.equal(payload.longitude, undefined);
});

test("verifiedOnly coerces to boolean on both keys", () => {
  const card = { ...baseCard(), verifiedOnly: true };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.verifiedOnly, true);
  assert.equal(payload.verified_only, true);
});

test("singles payload includes selectable alternative times and locations", () => {
  const card = {
    ...baseCard(),
    totalPlayers: 1,
    format: "Singles",
    timeOptions: ["2026-06-21T18:00:00.000Z"],
    locationOptions: [{ location_text: "Ocean View Courts", latitude: 34.01, longitude: -118.48 }],
  };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.deepEqual(payload.time_options, ["2026-06-21T18:00:00.000Z"]);
  assert.deepEqual(payload.location_options, [
    { location_text: "Ocean View Courts", latitude: 34.01, longitude: -118.48 },
  ]);
});

test("my-level falls back to skillLevel when min/max absent", () => {
  const card = { ...baseCard(), skillLevelMin: "", skillLevelMax: "", skillLevel: "4.0" };
  const payload = buildMatchPayload(card, { type: "open" });
  assert.equal(payload.skill_level_min, "4.0");
  assert.equal(payload.skill_level_max, "4.0");
});

test("invalid date/time throws", () => {
  assert.throws(() => buildMatchPayload({ ...baseCard(), date: "", startTime: "" }, { type: "open" }));
});

test("normalizeFormat passes through already-correct backend values", () => {
  assert.equal(normalizeFormat("Doubles"), "Doubles");
  assert.equal(normalizeFormat("Round Robin"), "Round Robin");
  assert.equal(normalizeFormat("Round-robin"), "Round Robin");
});

// ---- buildMatchPayloadFromCard: N=1 equivalence with the legacy flow ----

const baseFlowCard = () => ({
  format: "Doubles",
  count: 4,
  levelMode: "range",
  rMin: "3.0",
  rMax: "4.0",
  date: DATE,
  startTime: TIME,
  duration: "2",
  location: "Penmar Recreation Center",
  latitude: 33.99,
  longitude: -118.46,
});

test("card → open/broadcast payload is identical to legacy single-match output", () => {
  const payload = buildMatchPayloadFromCard(baseFlowCard(), {
    type: "open",
    playerRating: null,
    shareChoice: "broadcast",
  });
  // The literal here mirrors MatchCreatorFlow.jsx handlePublish (lines 815-849)
  // for the same user inputs — this is the byte-for-byte N=1 guarantee.
  assert.deepEqual(payload, {
    status: "upcoming",
    match_type: "open",
    start_date_time: expectedIso,
    durationMinutes: 120,
    duration_minutes: 120,
    location_text: "Penmar Recreation Center",
    latitude: 33.99,
    longitude: -118.46,
    player_limit: 4,
    match_format: "Doubles",
    notes: undefined,
    skill_level_min: "3.0",
    skill_level_max: "4.0",
    gender: "Any",
    category: "Any",
    balls: "Host provides",
    verifiedOnly: false,
    verified_only: false,
    hidden: false,
    is_hidden: false,
    listing_visibility: "listed",
  });
});

test("card → private payload is identical to legacy single-match output", () => {
  const payload = buildMatchPayloadFromCard(baseFlowCard(), {
    type: "private",
    playerRating: null,
    shareChoice: "broadcast",
  });
  assert.deepEqual(payload, {
    status: "upcoming",
    match_type: "private",
    start_date_time: expectedIso,
    durationMinutes: 120,
    duration_minutes: 120,
    location_text: "Penmar Recreation Center",
    latitude: 33.99,
    longitude: -118.46,
    player_limit: 4,
    match_format: "Doubles",
    notes: undefined,
  });
});

test("card my-level maps player rating into skill min and max", () => {
  const card = { ...baseFlowCard(), levelMode: "my" };
  const payload = buildMatchPayloadFromCard(card, {
    type: "open",
    playerRating: "4.0",
    shareChoice: "broadcast",
  });
  assert.equal(payload.skill_level_min, "4.0");
  assert.equal(payload.skill_level_max, "4.0");
});

test("card keep-on-profile (non-broadcast) produces link_only listing", () => {
  const payload = buildMatchPayloadFromCard(baseFlowCard(), {
    type: "open",
    playerRating: null,
    shareChoice: "profile",
  });
  assert.equal(payload.listing_visibility, "link_only");
  assert.equal(payload.is_hidden, true);
});

test("card Round-robin with custom count maps format + player_limit", () => {
  const card = { ...baseFlowCard(), format: "Round-robin", count: 6 };
  const payload = buildMatchPayloadFromCard(card, {
    type: "open",
    playerRating: null,
    shareChoice: "broadcast",
  });
  assert.equal(payload.match_format, "Round Robin");
  assert.equal(payload.player_limit, 6);
});
