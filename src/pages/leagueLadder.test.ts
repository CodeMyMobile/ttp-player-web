import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeagueChallengeState,
  buildLeagueLadderRows,
  buildSuggestedChallengeRows,
} from "./leagueLadder";

const players = [
  {
    player_id: 4,
    full_name: "Michael Joaquin",
    current_rating: "7.179",
    calculated_ntrp: "4.50",
    calculated_utr: "8.1",
    is_estimate: false,
    rating_source: "results",
    court_locations: [{ location: "Cheviot Hills" }],
  },
  {
    player_id: 3,
    full_name: "Kevin Kurstin",
    current_rating: "7.191",
    calculated_ntrp: "4.50",
    calculated_utr: "8.2",
    is_estimate: true,
    rating_source: "self_rated",
    court_locations: [{ location: "Westwood Rec" }],
  },
  {
    player_id: 5,
    full_name: "Seb Mosso",
    current_rating: "7.145",
    calculated_ntrp: "4.50",
    calculated_utr: "8.0",
    is_estimate: false,
    rating_source: "verified",
    court_locations: [{ location: "Cheviot Hills" }],
  },
  {
    player_id: 8,
    full_name: "Unrated Player",
    current_rating: null,
  },
  {
    player_id: 210,
    full_name: "Player25",
    current_rating: null,
    usta_rating: "5.0",
    uta_rating: "5.0",
    self_rating_source: "player",
  },
];

const standings = [
  { player_id: 4, wins: 2, losses: 1 },
  { player_id: 3, wins: 7, losses: 3 },
  { player_id: 5, wins: 3, losses: 0 },
  { player_id: 210, wins: 0, losses: 0 },
];

test("buildLeagueLadderRows ranks players with TRP or self-entered ratings", () => {
  const rows = buildLeagueLadderRows({ players, standings, viewerId: 4 });

  assert.deepEqual(rows.map((row) => row.playerId), ["3", "4", "5", "210"]);
  assert.equal(rows[0]?.rank, 1);
  assert.equal(rows[1]?.isViewer, true);
  assert.equal(rows[1]?.recordLabel, "2-1");
  assert.equal(rows[0]?.ratingBadge, "Estimated");
  assert.equal(rows[3]?.ratingLabel, "5.0");
  assert.equal(rows[3]?.ratingType, "NTRP");
});

test("buildSuggestedChallengeRows picks nearby non-viewer opponents", () => {
  const rows = buildLeagueLadderRows({ players, standings, viewerId: 4 });
  const suggested = buildSuggestedChallengeRows(rows, "4");

  assert.deepEqual(suggested.map((row) => row.playerId), ["3", "5", "210"]);
  assert.equal(suggested[0]?.suggestionReason, "0.012 above you");
  assert.equal(suggested[1]?.suggestionReason, "0.034 below you");
});

test("buildLeagueChallengeState opens private match creation with opponent context", () => {
  const rows = buildLeagueLadderRows({ players, standings, viewerId: 4 });
  const state = buildLeagueChallengeState({
    row: rows[0],
    leagueName: "West LA Ladder",
  });

  assert.equal(state.connectIntent.invitee.id, "3");
  assert.equal(state.connectIntent.invitee.name, "Kevin Kurstin");
  assert.equal(state.connectIntent.source, "league-ladder");
  assert.equal(state.connectIntent.preferredCourt, "Westwood Rec");
  assert.equal(state.connectIntent.senderLevel, "TRP 7.191");
});
