import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isVerifiedRating,
  matchesLabel,
  ratingStatusLabel,
  ratingValue,
  tprLabel,
  viewerGapLabel,
} from "./ladderRow";
import { buildLeagueLadderRows } from "../../pages/leagueLadder";

/* status badge */

test("the badge is never blank", () => {
  assert.equal(ratingStatusLabel("Verified"), "Verified");
  assert.equal(ratingStatusLabel("Estimated"), "est.");
  assert.equal(ratingStatusLabel(null), "est.");
  assert.equal(ratingStatusLabel(undefined), "est.");
  assert.equal(ratingStatusLabel(""), "est.");
});

test("earned and vouched both read as Verified for now", () => {
  assert.equal(isVerifiedRating("Verified"), true);
  assert.equal(isVerifiedRating("verified"), true);
  assert.equal(isVerifiedRating("Estimated"), false);
});

/* matches count */

test("the count reads naturally and pluralises", () => {
  assert.equal(matchesLabel(12, "Estimated"), "12 matches");
  assert.equal(matchesLabel(1, "Estimated"), "1 match");
  assert.equal(matchesLabel(0, "Estimated"), "0 matches");
});

test("a vouched player's zero count is withheld, not printed", () => {
  // verified_level_count >= 3 yields Verified with matches_played 0;
  // "Verified · 0 matches" contradicts itself.
  assert.equal(matchesLabel(0, "Verified"), "—");
});

test("a missing count is an em dash", () => {
  assert.equal(matchesLabel(null, "Estimated"), "—");
  assert.equal(matchesLabel(undefined, "Estimated"), "—");
  assert.equal(matchesLabel(-1, "Estimated"), "—");
});

/* values */

test("missing NTRP/UTR renders an em dash, keeping the label", () => {
  assert.equal(ratingValue("4.25"), "4.25");
  assert.equal(ratingValue("-"), "—", "the shared helper's dash becomes a true em dash");
  assert.equal(ratingValue(null), "—");
  assert.equal(ratingValue(""), "—");
});

test("TPR is two decimals, never three", () => {
  assert.equal(tprLabel(7), "7.00");
  assert.equal(tprLabel(6.789938), "6.79");
  assert.equal(tprLabel(null), "—");
});

/* viewer gap copy */

test("the viewer measures against the player above", () => {
  assert.equal(
    viewerGapLabel({ rank: 4, rating: 6.0 }, { rank: 3, rating: 6.14 }, { rank: 5, rating: 5.2 }),
    "0.14 behind #3",
  );
});

test("at the top of the ladder the viewer measures against the player below", () => {
  assert.equal(
    viewerGapLabel({ rank: 1, rating: 7.12 }, null, { rank: 2, rating: 6.0 }),
    "1.12 clear of #2",
  );
});

test("alone in the division there is no gap to state", () => {
  assert.equal(viewerGapLabel({ rank: 1, rating: 7 }, null, null), null);
});

/* the sort this row depends on */

test("ties break by name, deterministically across rebuilds", () => {
  // Nothing covered the LADDER's comparator before — the existing tie test is on
  // PublicMatchResultsPage, a different sort path.
  const players = [
    { player_id: 3, full_name: "Cara Lee", current_rating: 6, matches_played: 2 },
    { player_id: 1, full_name: "Ana Ruiz", current_rating: 6, matches_played: 2 },
    { player_id: 2, full_name: "Ben Tan", current_rating: 6, matches_played: 2 },
  ];
  const order = () =>
    buildLeagueLadderRows({ players: players as never, standings: [], viewerId: null })
      .map((row) => row.name);

  assert.deepEqual(order(), ["Ana Ruiz", "Ben Tan", "Cara Lee"]);
  assert.deepEqual(order(), order(), "same input, same order, every render");
});

test("rating still outranks name", () => {
  const players = [
    { player_id: 1, full_name: "Ana Ruiz", current_rating: 5, matches_played: 1 },
    { player_id: 2, full_name: "Zed Vance", current_rating: 7, matches_played: 1 },
  ];
  const rows = buildLeagueLadderRows({ players: players as never, standings: [], viewerId: null });
  assert.deepEqual(rows.map((r) => r.name), ["Zed Vance", "Ana Ruiz"]);
});
