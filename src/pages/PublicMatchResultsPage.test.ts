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

test("decorateRankings is deterministic and invents no availability", () => {
  const first = decorateRankings(rankings);
  const second = decorateRankings(rankings);

  assert.equal(first[0].primaryCourt, second[0].primaryCourt);
  assert.equal(first[2].initials, "KK");
  // The old side panel showed an "availability" picked from a hardcoded list by
  // hashing the player record. Nobody told us when these players are free, so
  // the field is gone rather than guessed.
  assert.ok(!("availability" in first[0]));
});

test("decorateRankings prefers a real photo and falls back to initials", () => {
  // The backend sends profile_picture, but the helper still tolerates alternate
  // names and rejects half-formed URLs rather than rendering broken images.
  const base = { rank: 1, current_rating: 4.2, rating_change: 0, matches_played: 3, wins: 2, losses: 1, is_provisional: false, is_estimate: false };
  const [none, real, keyOnly, bucket, blank, later] = decorateRankings([
    { ...base, user_id: 1, full_name: "No Photo" },
    { ...base, user_id: 2, full_name: "Real Photo", profile_picture: "https://tennisplan.s3.amazonaws.com/players/2.jpg" },
    { ...base, user_id: 1290, full_name: "Key Only", profile_picture: "1290-4868811.jpeg" },
    { ...base, user_id: 3, full_name: "Bucket Root", profile_image: "https://tennisplan.s3.amazonaws.com/" },
    { ...base, user_id: 4, full_name: "Blank Field", avatar_url: "   " },
    { ...base, user_id: 5, full_name: "Later Field", image: "https://tennisplan.s3.amazonaws.com/", avatarUrl: "https://cdn.example.com/a/5.png" },
  ] as never);

  assert.equal(none.photoUrl, null);
  assert.equal(real.photoUrl, "https://tennisplan.s3.amazonaws.com/players/2.jpg");
  assert.equal(keyOnly.photoUrl, "https://ttp-avatars-production.s3.amazonaws.com/1290-4868811.jpeg");
  assert.equal(bucket.photoUrl, null, "a bare bucket root is not a photo");
  assert.equal(blank.photoUrl, null);
  assert.equal(later.photoUrl, "https://cdn.example.com/a/5.png", "keeps looking past an unusable field");
  assert.equal(none.initials, "NP", "initials stay available as the fallback");
});

test("a challenge carries no invented availability", () => {
  const [ranking] = decorateRankings(rankings);
  const { connectIntent } = buildChallengeState(ranking);

  assert.deepEqual(connectIntent.suggestedAvailability, []);
  assert.equal(connectIntent.invitee.name, ranking.full_name);
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

/**
 * Both halves of a ladder row's "0.0 mi · Mar Vista Courts" were invented for
 * players we know nothing about. Verified against production on 2026-08-22:
 * 1017 of 1231 players have neither primary_court nor court_locations, and
 * distance_miles is null for every player once the radius filter is gone.
 */
test("a player with no court on file gets no court, not a hashed one", () => {
  const rows = [
    { user_id: 1393, full_name: "Josh Berenbaum", current_rating: 7.33, primary_court: null, court_locations: [] },
    { user_id: 1386, full_name: "Kevin Kurstin", current_rating: 7.24, primary_court: null, court_locations: null },
  ] as never;

  decorateRankings(rows).forEach((row) => {
    assert.equal(row.primaryCourt, null, `${row.full_name} must not be assigned a court`);
  });
});

test("a real court is still shown, from either field", () => {
  const rows = [
    { user_id: 6, full_name: "Paul Cochrane", current_rating: 7, primary_court: "Penmar Recreation Center" },
    { user_id: 1290, full_name: "Szu Lee", current_rating: 8.19, court_locations: [{ location: "Mar Vista Recreation Center" }] },
  ] as never;

  const [paul, szu] = decorateRankings(rows);
  assert.equal(paul.primaryCourt, "Penmar Recreation Center");
  assert.equal(szu.primaryCourt, "Mar Vista Recreation Center");
});

test("an unknown distance is absent, not zero", () => {
  // Number(null) === 0 and 0 is finite, so the old guard let a missing distance
  // through and every row read "0.0 mi".
  const rows = [
    { user_id: 1, full_name: "No Distance", current_rating: 5 },
    { user_id: 2, full_name: "Null Distance", current_rating: 5, distance_miles: null },
    { user_id: 3, full_name: "Empty Distance", current_rating: 5, distance_miles: "" },
    { user_id: 4, full_name: "Real Distance", current_rating: 5, distance_miles: 2.4 },
  ] as never;

  const [none, nul, empty, real] = decorateRankings(rows);
  assert.equal(none.distanceLabel, null);
  assert.equal(nul.distanceLabel, null);
  assert.equal(empty.distanceLabel, null);
  assert.equal(real.distanceLabel, "2.4 mi", "a real distance still renders");
});

test("the ladder request is unscoped now that the filters are gone", () => {
  const url = buildRankingsUrl();
  assert.ok(!url.includes("near_lat"), "no location filter");
  assert.ok(!url.includes("radius_miles"), "no radius filter");
});
