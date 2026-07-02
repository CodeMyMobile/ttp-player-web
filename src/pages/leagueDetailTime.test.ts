import assert from "node:assert/strict";
import test from "node:test";

import { formatLeagueDate, formatLeagueTime } from "./leagueDetailTime";

test("formats UTC league match time in league timezone", () => {
  assert.equal(formatLeagueDate("2026-07-06T22:00:00.000Z", "America/Los_Angeles"), "Jul 6, 2026");
  assert.equal(formatLeagueTime("2026-07-06T22:00:00.000Z", "America/Los_Angeles"), "3:00 PM");
});

test("formats date-only and time-only values without timezone shifting", () => {
  assert.equal(formatLeagueDate("2026-07-06"), "Jul 6, 2026");
  assert.equal(formatLeagueTime("15:00"), "3:00 PM");
});
