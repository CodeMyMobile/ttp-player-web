import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import {
  buildChallengeState,
  decorateRankings,
  filterRankingsByPlace,
  getSuggestedRankings,
} from "./PublicMatchResultsPage";

test("estimate badge follows is_estimate, not provisional K status", () => {
  assert.equal(shouldShowEstimateBadge({ is_provisional: true, is_estimate: false }), false);
  assert.equal(shouldShowEstimateBadge({ is_provisional: false, is_estimate: true }), true);
});

const rankings = [
  { rank: 1, user_id: 1290, full_name: "Szu Lee", current_rating: 8.109739, calculated_ntrp: 5, calculated_utr: 9.66, wins: 4, losses: 0, matches_played: 4, rating_change: 1.1, is_estimate: false, is_provisional: true },
  { rank: 2, user_id: 1393, full_name: "Josh Berenbaum", current_rating: 7.33117, calculated_ntrp: 4.75, calculated_utr: 8.5, wins: 4, losses: 1, matches_played: 5, rating_change: 0.33, is_estimate: false, is_provisional: false },
  { rank: 3, user_id: 1386, full_name: "Kevin Kurstin", current_rating: 7.202916, calculated_ntrp: 4.5, calculated_utr: 8.3, wins: 7, losses: 3, matches_played: 10, rating_change: 0.7, is_estimate: false, is_provisional: false, primary_court: "Westwood Rec", court_area: "Westwood", court_locations: [{ location: "Westwood Rec", area: "Westwood" }] },
  { rank: 4, user_id: 1390, full_name: "Michael Joaquin", current_rating: 7.180547, calculated_ntrp: 4.5, calculated_utr: 8.27, wins: 2, losses: 1, matches_played: 3, rating_change: 0.18, is_estimate: false, is_provisional: true },
];

test("decorateRankings adds deterministic seeded court and availability metadata", () => {
  const first = decorateRankings(rankings);
  const second = decorateRankings(rankings);

  assert.equal(first[0].primaryCourt, second[0].primaryCourt);
  assert.equal(first[2].initials, "KK");
  assert.ok(first[2].availability.length > 0);
});

test("getSuggestedRankings picks closest non-viewer levels first", () => {
  const decorated = decorateRankings(rankings);
  const viewer = decorated.find((row) => row.full_name === "Michael Joaquin");
  const suggestions = getSuggestedRankings(decorated, viewer, 2);

  assert.deepEqual(suggestions.map((row) => row.full_name), ["Kevin Kurstin", "Josh Berenbaum"]);
});

test("buildChallengeState opens private match creation with ranking context", () => {
  const [opponent] = decorateRankings(rankings);
  const state = buildChallengeState(opponent);

  assert.equal(state.connectIntent.invitee.id, "1290");
  assert.equal(state.connectIntent.invitee.level, "TRP 8.110");
  assert.equal(state.connectIntent.source, "match-results-ladder");
});

test("filterRankingsByPlace narrows by seeded location and court", () => {
  const decorated = decorateRankings(rankings);
  const kevin = decorated.find((row) => row.full_name === "Kevin Kurstin");
  assert.ok(kevin);

  const filtered = filterRankingsByPlace(decorated, {
    area: kevin.courtArea,
    court: kevin.primaryCourt,
  });

  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((row) => row.courtArea === kevin.courtArea));
  assert.ok(filtered.every((row) => row.primaryCourt === kevin.primaryCourt));
});
