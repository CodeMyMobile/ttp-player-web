import assert from "node:assert/strict";
import test from "node:test";

import {
  levelFromParam,
  formatFromParam,
  genderFromParam,
  distanceFromParam,
  dayFromParam,
} from "./matchFilterParams.js";

test("levelFromParam maps valid NTRP levels through", () => {
  assert.equal(levelFromParam("2.5"), "2.5");
  assert.equal(levelFromParam("3.0"), "3.0");
  assert.equal(levelFromParam("3.5"), "3.5");
  assert.equal(levelFromParam("4.0"), "4.0");
});

test("levelFromParam maps 4.5 to the 4.5+ bucket", () => {
  assert.equal(levelFromParam("4.5"), "4.5+");
  assert.equal(levelFromParam("4.5+"), "4.5+");
  // URLSearchParams decodes + to a space; trimming recovers the value.
  assert.equal(levelFromParam("4.5 "), "4.5+");
});

test("levelFromParam rejects invalid/absent values", () => {
  assert.equal(levelFromParam("9.9"), null);
  assert.equal(levelFromParam("banana"), null);
  assert.equal(levelFromParam(""), null);
  assert.equal(levelFromParam(null), null);
  assert.equal(levelFromParam(undefined), null);
});

test("formatFromParam maps slugs to internal labels", () => {
  assert.equal(formatFromParam("singles"), "Singles");
  assert.equal(formatFromParam("doubles"), "Doubles");
  assert.equal(formatFromParam("round-robin"), "Round Robin");
  assert.equal(formatFromParam("dingles"), "Dingles");
  assert.equal(formatFromParam("other"), "Other");
});

test("formatFromParam is case-insensitive and trims", () => {
  assert.equal(formatFromParam("Singles"), "Singles");
  assert.equal(formatFromParam("  DOUBLES  "), "Doubles");
});

test("formatFromParam rejects invalid/absent values", () => {
  assert.equal(formatFromParam("banana"), null);
  assert.equal(formatFromParam(""), null);
  assert.equal(formatFromParam(null), null);
});

test("genderFromParam maps slugs to internal labels", () => {
  assert.equal(genderFromParam("mens"), "Men's");
  assert.equal(genderFromParam("womens"), "Women's");
  assert.equal(genderFromParam("mixed"), "Mixed");
  assert.equal(genderFromParam("MIXED"), "Mixed");
});

test("genderFromParam rejects invalid/absent values", () => {
  assert.equal(genderFromParam("nonbinary"), null);
  assert.equal(genderFromParam(""), null);
  assert.equal(genderFromParam(null), null);
});

test("distanceFromParam accepts the supported numeric distances", () => {
  assert.equal(distanceFromParam("5"), 5);
  assert.equal(distanceFromParam("10"), 10);
  assert.equal(distanceFromParam("20"), 20);
  assert.equal(distanceFromParam("50"), 50);
});

test("distanceFromParam rejects unsupported/invalid values", () => {
  assert.equal(distanceFromParam("7"), null);
  assert.equal(distanceFromParam("0"), null);
  assert.equal(distanceFromParam("-10"), null);
  assert.equal(distanceFromParam("banana"), null);
  assert.equal(distanceFromParam(""), null);
  assert.equal(distanceFromParam(null), null);
});

test("dayFromParam clears the filter on 'all'", () => {
  assert.equal(dayFromParam("all", ["2026-06-24"]), "");
  assert.equal(dayFromParam("ALL", ["2026-06-24"]), "");
});

test("dayFromParam seeds a valid in-strip date", () => {
  const keys = ["2026-06-24", "2026-06-25", "2026-06-26"];
  assert.equal(dayFromParam("2026-06-25", keys), "2026-06-25");
});

test("dayFromParam rejects off-strip or malformed dates", () => {
  const keys = ["2026-06-24", "2026-06-25"];
  assert.equal(dayFromParam("2026-12-31", keys), null);
  assert.equal(dayFromParam("06-25-2026", keys), null);
  assert.equal(dayFromParam("banana", keys), null);
  assert.equal(dayFromParam("", keys), null);
  assert.equal(dayFromParam(null, keys), null);
});
