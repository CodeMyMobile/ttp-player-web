import test from "node:test";
import assert from "node:assert/strict";

import { distanceMiles, formatDistanceMiles, leagueVenueDistanceMiles } from "./distance.ts";

test("distanceMiles — same point is 0", () => {
  assert.equal(distanceMiles(34.05, -118.24, 34.05, -118.24), 0);
});

test("distanceMiles — LA→NY is ~2440 mi (great-circle)", () => {
  const d = distanceMiles(34.0549, -118.2426, 40.7128, -74.006);
  assert.ok(d !== null && d > 2400 && d < 2480, `got ${d}`);
});

test("distanceMiles — invalid/absent input → null (never NaN)", () => {
  assert.equal(distanceMiles(null, -118, 34, -118), null);
  assert.equal(distanceMiles(34, undefined, 34, -118), null);
  assert.equal(distanceMiles("x", "y", "z", "w"), null);
});

test("formatDistanceMiles — rounds to whole miles, ~ prefix, no minutes", () => {
  assert.equal(formatDistanceMiles(7.4), "~7 mi");
  assert.equal(formatDistanceMiles(11.6), "~12 mi");
  assert.equal(formatDistanceMiles(null), null);
});

test("leagueVenueDistanceMiles — no player coords → null (chip omitted)", () => {
  const league = { venue_latitude: 34.05, venue_longitude: -118.24 };
  assert.equal(leagueVenueDistanceMiles(league, null), null);
});

test("leagueVenueDistanceMiles — league without venue coords → null", () => {
  assert.equal(
    leagueVenueDistanceMiles({}, { latitude: 34.05, longitude: -118.24 }),
    null,
  );
});

test("leagueVenueDistanceMiles — both present → a number", () => {
  const d = leagueVenueDistanceMiles(
    { venue_latitude: 34.14, venue_longitude: -118.25 },
    { latitude: 34.05, longitude: -118.24 },
  );
  assert.ok(typeof d === "number" && d > 0);
});
