import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatMatchDateTimeForDisplay,
  formatMatchTimeForDisplay,
  getMatchWallDate,
} from "./matchDateTime.js";

test("formats match time using utc_offset_minutes instead of browser local time", () => {
  const match = {
    start_date_time: "2026-07-08T14:00:00.000Z",
    utc_offset_minutes: -420,
  };

  assert.equal(formatMatchTimeForDisplay(match), "7:00 AM");
  assert.equal(formatMatchDateTimeForDisplay(match), "Wed, Jul 8, 7:00 AM");
});

test("formats match time using timezone when present", () => {
  const match = {
    start_date_time: "2026-07-09T02:30:00.000Z",
    timezone: "America/Los_Angeles",
    utc_offset_minutes: 330,
  };

  assert.equal(formatMatchTimeForDisplay(match), "7:30 PM");
  assert.equal(formatMatchDateTimeForDisplay(match), "Wed, Jul 8, 7:30 PM");
});

test("returns wall date for day grouping and headings", () => {
  const date = getMatchWallDate({
    start_date_time: "2026-07-08T14:00:00.000Z",
    utc_offset_minutes: -420,
  });

  assert.equal(date.getUTCFullYear(), 2026);
  assert.equal(date.getUTCMonth(), 6);
  assert.equal(date.getUTCDate(), 8);
  assert.equal(date.getUTCHours(), 7);
});
