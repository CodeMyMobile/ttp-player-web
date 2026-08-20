import assert from "node:assert/strict";
import test from "node:test";

import {
  activeSeasons,
  buildViewerIdentities,
  deriveSeasonEnrichment,
  isPastLeague,
  opponentNames,
} from "./leagueSeason";

const NOW = new Date(2026, 7, 20, 12, 0, 0);
const league = (over = {}) => ({ id: 1, name: "4.0 Flex", status: "active", ...over });

// --- which seasons are still running ----------------------------------------

test("every finished-ish status counts as past", () => {
  for (const status of ["finished", "completed", "complete", "ended", "closed", "archived", "past"]) {
    assert.equal(isPastLeague(league({ status }), NOW), true, status);
  }
  assert.equal(isPastLeague(league({ status: "active" }), NOW), false);
});

test("a season is past once its end date is behind today, but not on the day itself", () => {
  assert.equal(isPastLeague(league({ end_date: "2026-08-19" }), NOW), true);
  // Ends today — still running, and the player can still act on it.
  assert.equal(isPastLeague(league({ end_date: "2026-08-20" }), NOW), false);
  assert.equal(isPastLeague(league({ end_date: "2026-09-30" }), NOW), false);
});

test("no end date and no finished status means still running", () => {
  assert.equal(isPastLeague(league(), NOW), false);
  assert.equal(isPastLeague(league({ end_date: "not-a-date" }), NOW), false);
});

test("active seasons come back nearest deadline first, undated last", () => {
  const seasons = activeSeasons(
    [
      league({ id: "far", end_date: "2026-10-01" }),
      league({ id: "undated" }),
      league({ id: "soon", end_date: "2026-08-25" }),
      league({ id: "over", end_date: "2026-01-01" }),
    ],
    NOW,
  );

  assert.deepEqual(seasons.map((s) => s.id), ["soon", "far", "undated"]);
});

// --- progress ---------------------------------------------------------------

const ids = buildViewerIdentities({ id: 7, full_name: "Paul C" }, null);
const fixture = (over = {}) => ({ id: 1, player1_id: 7, player1_name: "Paul C", player2_id: 99, ...over });

test("a fixture counts as played when it has a score, not a date", () => {
  // played_date is unreliable here; a logged score is what marks a match done.
  const e = deriveSeasonEnrichment({
    standings: [{ player_id: 7, full_name: "Paul C", rank: 2 }],
    fixtures: [
      fixture({ id: 1, score: "6-4 6-2" }),
      fixture({ id: 2, score: "  " }),
      fixture({ id: 3, score: null, played_date: "2026-08-01" }),
    ],
    viewerIdentities: ids,
  });

  assert.equal(e.matchesPlayed, 1);
  assert.equal(e.matchesTotal, 3);
});

test("with no fixtures the total falls back to round-robin, players minus one", () => {
  const e = deriveSeasonEnrichment({
    standings: Array.from({ length: 9 }, (_, i) => ({ player_id: i === 0 ? 7 : 100 + i, matches_played: 5 })),
    fixtures: [],
    viewerIdentities: ids,
  });

  assert.equal(e.matchesTotal, 8);
  assert.equal(e.matchesPlayed, 5, "falls back to the standings row");
});

test("no standings at all means pre-season", () => {
  const e = deriveSeasonEnrichment({ standings: [], fixtures: [], viewerIdentities: ids });

  assert.equal(e.preSeason, true);
  assert.equal(e.matchesTotal, 0);
});

test("another player's fixtures are filtered out client-side", () => {
  // The backend has been seen ignoring mine=true and returning the whole league.
  const e = deriveSeasonEnrichment({
    standings: [{ player_id: 7, full_name: "Paul C" }],
    fixtures: [
      fixture({ id: 1, score: "6-0 6-0" }),
      { id: 2, player1_id: 55, player1_name: "Someone", player2_id: 56, score: "6-1 6-1" },
    ],
    viewerIdentities: ids,
  });

  assert.equal(e.matchesTotal, 1);
  assert.equal(e.matchesPlayed, 1);
});

// --- opponents --------------------------------------------------------------

test("opponents render as first names, capped", () => {
  const names = [{ full_name: "Sam Reyes" }, { full_name: "Dan Ho" }, { full_name: "Priya N" }];

  assert.equal(opponentNames(names), "Sam, Dan, Priya");
  assert.equal(opponentNames([...names, { full_name: "Ana Ruiz" }]), "Sam, Dan, Priya +1");
  assert.equal(opponentNames([{ full_name: "Sam Reyes" }]), "Sam");
});

test("nobody left to play yields null, so the clause is omitted", () => {
  assert.equal(opponentNames([]), null);
  assert.equal(opponentNames(), null);
  assert.equal(opponentNames([{ full_name: "  " }, { full_name: null }]), null);
});
