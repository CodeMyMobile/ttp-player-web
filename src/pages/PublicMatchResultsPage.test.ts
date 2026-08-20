import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { buildViewerIdentities } from "../utils/leagueSeason";
import {
  buildChallengeState,
  buildRankingsUrl,
  buildReverseGeocodeUrl,
  decorateRankings,
  findViewer,
  formatCoordinatesLabel,
  getSuggestedRankings,
  labelFromReverseGeocode,
  orderLadder,
  resolveCourtFilterSelection,
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

test("buildRankingsUrl sends radius search params", () => {
  const url = buildRankingsUrl({
    nearLat: 34.05,
    nearLng: -118.45,
    radiusMiles: 10,
  });

  assert.ok(url.includes("/match-results/rankings?"));
  assert.ok(url.includes("near_lat=34.05"));
  assert.ok(url.includes("near_lng=-118.45"));
  assert.ok(url.includes("radius_miles=10"));
});

test("decorateRankings formats backend distance when radius search is used", () => {
  const [first] = decorateRankings([
    { ...rankings[0], distance_miles: "4.27" },
  ]);

  assert.equal(first.distanceMiles, 4.27);
  assert.equal(first.distanceLabel, "4.3 mi");
});

test("reverse geocode helpers build location label from coordinates", () => {
  const coords = { latitude: 34.05, longitude: -118.45 };
  const url = buildReverseGeocodeUrl(coords);
  const label = labelFromReverseGeocode({
    address: { city: "Los Angeles", state: "California", country_code: "us" },
  }, formatCoordinatesLabel(coords));

  assert.ok(url.includes("lat=34.05"));
  assert.ok(url.includes("lon=-118.45"));
  assert.equal(formatCoordinatesLabel(coords), "34.05° N, 118.45° W");
  assert.equal(label, "Los Angeles, California, US");
});

test("court filter clears location when selected court is outside radius", () => {
  const result = resolveCourtFilterSelection({
    court: {
      id: 7,
      name: "Penmar Recreation Center",
      area: "Venice",
      latitude: 34.0001,
      longitude: -118.4501,
    },
    location: { latitude: 34.1478, longitude: -118.1445 },
    radiusMiles: 5,
  });

  assert.equal(result.clearLocation, true);
  assert.equal(result.nearLat, 34.0001);
  assert.equal(result.nearLng, -118.4501);
});

// --- ladder ordering and identity -------------------------------------------

const row = (id, name, rating, apiRank) => ({
  user_id: id, full_name: name, current_rating: rating, rank: apiRank,
  matches_played: 3, wins: 2, losses: 1, rating_change: 0,
  is_provisional: false, is_estimate: false, ratingNumber: rating,
});

test("the ladder is ordered by rating, not by the API's rank", () => {
  // The API assigns rank after re-sorting by distance, so under geo scoping it
  // is proximity order. Rank here deliberately disagrees with rating — if the
  // fixture agreed, the assertion would prove nothing.
  const byProximity = [
    row(1, "Ana", 4.1, 1),
    row(2, "Sam", 6.2, 2),
    row(3, "Dan", 5.0, 3),
    row(4, "You", 3.8, 4),
  ];

  const ordered = orderLadder(byProximity);

  assert.deepEqual(ordered.map((r) => r.full_name), ["Sam", "Dan", "Ana", "You"]);
  assert.deepEqual(ordered.map((r) => r.ladderPosition), [1, 2, 3, 4]);
});

test("equal ratings keep the order they arrived in", () => {
  const ordered = orderLadder([row(1, "First", 5.0, 9), row(2, "Second", 5.0, 1)]);

  assert.deepEqual(ordered.map((r) => r.full_name), ["First", "Second"]);
});

test("unrated players sort last rather than being dropped from the ladder", () => {
  const ordered = orderLadder([row(1, "Unrated", 0, 1), row(2, "Rated", 4.5, 2)]);

  assert.deepEqual(ordered.map((r) => r.full_name), ["Rated", "Unrated"]);
  assert.equal(ordered.length, 2, "the ladder lists everyone");
});

test("the viewer is found by id, not by position", () => {
  const ladder = orderLadder([row(1, "Ana", 4.1, 1), row(7, "You", 3.8, 4)]);

  assert.equal(findViewer(ladder, buildViewerIdentities({ id: 7 }, null))?.full_name, "You");
  assert.equal(
    findViewer(ladder, buildViewerIdentities({ id: "7" }, null))?.full_name,
    "You",
    "ids arrive as strings too",
  );
});

test("the viewer is found by name when the id spaces differ", () => {
  // The account id and the ranking's user_id are different id-spaces, so an
  // id-only compare silently finds nobody — which is what an absent card looked
  // like.
  const ladder = orderLadder([row(1, "Ana Ruiz", 4.1, 1), row(482, "Paul Cochrane", 3.8, 2)]);
  const identities = buildViewerIdentities({ id: 9999, full_name: "Paul Cochrane" }, null);

  assert.equal(findViewer(ladder, identities)?.full_name, "Paul Cochrane");
});

test("nobody is highlighted when the viewer is not in the list", () => {
  // The regression: this used to fall back to decorated[3], so a logged-out
  // visitor was shown a stranger badged "you".
  const ladder = orderLadder([row(1, "Ana", 4.1, 1), row(2, "Sam", 6.2, 2), row(3, "Dan", 5.0, 3), row(4, "Bo", 3.8, 4)]);

  assert.equal(findViewer(ladder, buildViewerIdentities(null, null)), null, "logged out");
  assert.equal(findViewer(ladder, buildViewerIdentities({ id: 999 }, null)), null, "outside the radius");
  assert.equal(findViewer([], buildViewerIdentities({ id: 7 }, null)), null, "empty ladder");
});
