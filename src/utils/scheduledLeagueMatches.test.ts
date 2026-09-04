import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScheduledLeagueMatches,
  toScheduledLeagueMatch,
} from "./scheduledLeagueMatches";

// Shape mirrors GET /matches?filter=my&status=confirmed, which selects matches.* and
// enriches each row with its participants' profiles.
const leagueMatch = ({
  id,
  leagueId = 12,
  hostId = 6,
  start = "2026-09-10T18:00:00.000Z",
  location = "Penmar Recreation Center",
  participants = [
    { player_id: 6, status: "hosting", profile: { full_name: "Paul Cochrane" } },
    { player_id: 1688, status: "confirmed", profile: { full_name: "Keiko Shinomoto" } },
  ],
}: Record<string, unknown> = {}) => ({
  id,
  is_league_match: true,
  league_id: leagueId,
  host_id: hostId,
  start_date_time: start,
  timezone: "America/Los_Angeles",
  location_text: location,
  participants,
});

test("names the other player as the opponent, from either side", () => {
  const match = leagueMatch({ id: 900 });

  assert.equal(toScheduledLeagueMatch(match, 6)?.opponentName, "Keiko Shinomoto");
  assert.equal(toScheduledLeagueMatch(match, 1688)?.opponentName, "Paul Cochrane");
});

test("flags who posted the match, per viewer", () => {
  const match = leagueMatch({ id: 900, hostId: 6 });

  assert.equal(toScheduledLeagueMatch(match, 6)?.viewerIsHost, true);
  assert.equal(toScheduledLeagueMatch(match, 1688)?.viewerIsHost, false);
});

test("compares ids as strings — stored auth payloads carry them as strings", () => {
  const match = leagueMatch({ id: 900, hostId: 6 });

  assert.equal(toScheduledLeagueMatch(match, "6")?.viewerIsHost, true);
  assert.equal(toScheduledLeagueMatch(match, "6")?.opponentName, "Keiko Shinomoto");
});

test("ignores anything that is not a league match", () => {
  assert.equal(toScheduledLeagueMatch({ id: 1, is_league_match: false }, 6), null);
  assert.equal(toScheduledLeagueMatch({ id: 2 }, 6), null);
  assert.equal(toScheduledLeagueMatch(null, 6), null);
});

test("falls back to a neutral label when the opponent has no profile", () => {
  const match = leagueMatch({
    id: 900,
    participants: [{ player_id: 6, status: "hosting", profile: { full_name: "Paul Cochrane" } }],
  });

  // Viewer is the only participant, so there is no opponent row to read a name from.
  assert.equal(toScheduledLeagueMatch(match, 6)?.opponentName, "League player");
});

test("drops a match the viewer has withdrawn from", () => {
  // filter=my joins match_participants with no status filter, so a match you left still
  // comes back as yours. It must not keep offering a Cancel button.
  const match = leagueMatch({
    id: 900,
    participants: [
      { player_id: 1688, status: "hosting", profile: { full_name: "Fernando Ruiz" } },
      { player_id: 6, status: "left", profile: { full_name: "Paul Cochrane" } },
    ],
  });

  assert.equal(toScheduledLeagueMatch(match, 6), null);
  // The host still sees it — they have not gone anywhere.
  assert.equal(toScheduledLeagueMatch(match, 1688)?.opponentName, "Paul Cochrane");
});

test("drops a match the viewer was removed from", () => {
  const match = leagueMatch({
    id: 900,
    participants: [
      { player_id: 1688, status: "hosting", profile: { full_name: "Fernando Ruiz" } },
      { player_id: 6, status: "removed", profile: { full_name: "Paul Cochrane" } },
    ],
  });

  assert.equal(toScheduledLeagueMatch(match, 6), null);
});

test("keeps only the requested league — filter=my spans every league", () => {
  const rows = buildScheduledLeagueMatches({
    matches: [
      leagueMatch({ id: 900, leagueId: 12 }),
      leagueMatch({ id: 901, leagueId: 11 }),
      { id: 902, is_league_match: false, host_id: 6, participants: [] },
    ],
    leagueId: 12,
    viewerId: 6,
  });

  assert.deepEqual(rows.map((row) => row.id), [900]);
});

test("sorts soonest first and puts undated matches last", () => {
  const rows = buildScheduledLeagueMatches({
    matches: [
      leagueMatch({ id: 903, start: null }),
      leagueMatch({ id: 902, start: "2026-09-20T18:00:00.000Z" }),
      leagueMatch({ id: 901, start: "2026-09-05T18:00:00.000Z" }),
    ],
    leagueId: 12,
    viewerId: 6,
  });

  assert.deepEqual(rows.map((row) => row.id), [901, 902, 903]);
});

test("survives a missing date and location rather than rendering blanks", () => {
  const [row] = buildScheduledLeagueMatches({
    matches: [leagueMatch({ id: 900, start: null, location: null })],
    leagueId: 12,
    viewerId: 6,
  });

  assert.equal(row.startDateTime, null);
  assert.equal(row.location, null);
  assert.equal(row.opponentName, "Keiko Shinomoto");
});
