import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVenueLabel } from "./venueLabel.ts";

// Real strings pulled from the prod coach-profile API (coachingLocations / booking slot locations).
const REAL = {
  "Penmar Recreation Center 1341 Lake St, Venice, CA 90291, USA": {
    short: "Penmar Recreation Center",
    keep: "Penmar Recreation Center",
  },
  "Culver City High School Tennis Court Culver City, CA 90230, USA": {
    short: "Culver City High School",
    keep: "Culver City High School Tennis Court",
  },
  "Glen Alla Park 4601 Alla Rd, Marina Del Rey, CA 90292, USA": {
    short: "Glen Alla Park",
    keep: "Glen Alla Park",
  },
  "Cheviot Hills Tennis Center 2601 Motor Ave #3411, Los Angeles, CA 90064, USA": {
    short: "Cheviot Hills Tennis Center",
    keep: "Cheviot Hills Tennis Center",
  },
  "Mar Vista Recreation Center 11430 Woodbine St, Los Angeles, CA 90066, USA": {
    short: "Mar Vista Recreation Center",
    keep: "Mar Vista Recreation Center",
  },
  "Stoner Recreation Center 1835 Stoner Ave, Los Angeles, CA 90025, USA": {
    short: "Stoner Recreation Center",
    keep: "Stoner Recreation Center",
  },
  "Veterans Memorial Park 4117 Overland Ave, Culver City, CA 90230, USA": {
    short: "Veterans Memorial Park",
    keep: "Veterans Memorial Park",
  },
  "Marine Park 1406 Marine St, Santa Monica, CA 90405, USA": {
    short: "Marine Park",
    keep: "Marine Park",
  },
  // Pure street address, no venue name — returned unchanged (it IS the location).
  "11938 Chaparal St, Los Angeles, CA 90049, USA": {
    short: "11938 Chaparal St",
    keep: "11938 Chaparal St",
  },
};

test("normalizeVenueLabel — short form (card / header) on real prod venues", () => {
  for (const [raw, { short }] of Object.entries(REAL)) {
    assert.equal(normalizeVenueLabel(raw), short, raw);
  }
});

test("normalizeVenueLabel — keepFacility form (slot / where-you-play) on real prod venues", () => {
  for (const [raw, { keep }] of Object.entries(REAL)) {
    assert.equal(normalizeVenueLabel(raw, { keepFacility: true }), keep, raw);
  }
});

test("normalizeVenueLabel — the doubled-city bug never reappears", () => {
  const raw = "Culver City High School Tennis Court Culver City, CA 90230, USA";
  assert.ok(!normalizeVenueLabel(raw).includes("Culver City High School Tennis Court Culver City"));
  assert.ok(
    !normalizeVenueLabel(raw, { keepFacility: true }).includes("Tennis Court Culver City"),
  );
});

test("normalizeVenueLabel — empty / nullish input", () => {
  assert.equal(normalizeVenueLabel(""), "");
  assert.equal(normalizeVenueLabel(null), "");
  assert.equal(normalizeVenueLabel(undefined), "");
});
