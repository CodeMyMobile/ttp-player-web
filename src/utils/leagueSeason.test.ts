import test from "node:test";
import assert from "node:assert/strict";

import { computeSeasonProgress, paceLine, weeksRemaining, LEAGUE_MIN_MATCHES } from "./leagueSeason.ts";

test("season progress mirrors the dashboard math (played/minimum)", () => {
  const p = computeSeasonProgress(4);
  assert.equal(p.played, 4);
  assert.equal(p.minimum, LEAGUE_MIN_MATCHES);
  assert.equal(p.pct, 67); // round(4/6*100) = round(66.67)
  assert.equal(p.met, false);
  assert.match(p.label, /4 of 6 minimum matches/);
});

test("minimum met at or above the threshold, capped at 100%", () => {
  const p = computeSeasonProgress(8);
  assert.equal(p.met, true);
  assert.equal(p.pct, 100);
});

test("archived → 'Season complete', 100%", () => {
  const p = computeSeasonProgress(3, true);
  assert.equal(p.label, "Season complete");
  assert.equal(p.pct, 100);
});

test("guards junk input (negative / NaN) to 0", () => {
  assert.equal(computeSeasonProgress(-2).played, 0);
  assert.equal(computeSeasonProgress("x" as unknown as number).played, 0);
});

test("weeksRemaining — whole weeks up, 0 once past, null when absent", () => {
  const now = Date.parse("2026-09-08T00:00:00Z");
  assert.equal(weeksRemaining("2026-10-06T00:00:00Z", now), 4); // exactly 4 weeks
  assert.equal(weeksRemaining("2026-10-05T00:00:00Z", now), 4); // 27 days → ceil to 4
  assert.equal(weeksRemaining("2026-09-01T00:00:00Z", now), 0); // past
  assert.equal(weeksRemaining(null, now), null);
  assert.equal(weeksRemaining("not-a-date", now), null);
});

test("pace line: matches left over weeks left, rounded up", () => {
  assert.equal(paceLine({ played: 3, total: 9, weeksLeft: 4 }), "About 2 matches a week to finish on time");
  assert.equal(paceLine({ played: 5, total: 8, weeksLeft: 3 }), "About 1 match a week to finish on time");
  assert.equal(paceLine({ played: 0, total: 7, weeksLeft: 2 }), "About 4 matches a week to finish on time");
});

test("pace line: done, or nothing honest to say", () => {
  assert.equal(paceLine({ played: 8, total: 8, weeksLeft: 3 }), "All your matches are played");
  assert.equal(paceLine({ played: 2, total: 8, weeksLeft: null }), null);
  assert.equal(paceLine({ played: 2, total: 8, weeksLeft: 0 }), null);
  assert.equal(paceLine({ played: 0, total: 0, weeksLeft: 5 }), null);
});
