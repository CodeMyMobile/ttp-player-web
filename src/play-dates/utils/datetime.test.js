import assert from "node:assert/strict";
import test from "node:test";

import { combineDateAndTimeToIso, zonedWallClockToIso } from "./datetime.js";

const withTz = (tz, fn) => {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};

test("a browser on Pacific time sends its own offset", () => {
  withTz("America/Los_Angeles", () => {
    assert.equal(combineDateAndTimeToIso("2026-11-23", "10:00"), "2026-11-23T10:00:00-08:00");
  });
});

test("a browser elsewhere keeps its own offset", () => {
  withTz("America/New_York", () => {
    assert.equal(combineDateAndTimeToIso("2026-11-23", "10:00"), "2026-11-23T10:00:00-05:00");
  });
});

test("a browser reporting UTC (privacy settings) reads the time as Pacific", () => {
  withTz("UTC", () => {
    assert.equal(combineDateAndTimeToIso("2026-11-23", "10:00"), "2026-11-23T10:00:00-08:00");
    assert.equal(combineDateAndTimeToIso("2026-06-20", "18:00"), "2026-06-20T18:00:00-07:00");
  });
});

test("Pacific offsets follow daylight saving changes", () => {
  const la = "America/Los_Angeles";
  assert.equal(zonedWallClockToIso(2026, 3, 7, 23, 30, la), "2026-03-07T23:30:00-08:00");
  assert.equal(zonedWallClockToIso(2026, 3, 8, 12, 0, la), "2026-03-08T12:00:00-07:00");
  assert.equal(zonedWallClockToIso(2026, 11, 1, 0, 30, la), "2026-11-01T00:30:00-07:00");
  assert.equal(zonedWallClockToIso(2026, 11, 1, 9, 0, la), "2026-11-01T09:00:00-08:00");
});
