import assert from "node:assert/strict";
import { test } from "node:test";

import { MIN_RANKABLE_RESULTS, isCurated, rankPlayers, scorePlayer } from "./playerRanking";

const viewer = {
  level: "4.0",
  courts: ["Penmar Recreation Center"],
  availability: ["Weekdays AM", "Weekends"],
};

const base = { level: "4.0", localCourts: [] as string[], availability: [] as string[] };

/* score */

test("a shared court outweighs every other signal combined", () => {
  const sharesCourt = scorePlayer({ ...base, localCourts: ["Penmar Rec"] }, viewer);
  const everythingElse = scorePlayer(
    {
      ...base,
      availability: ["Weekdays AM", "Weekends"],
      verified: true,
      profileImageUrl: "x",
    },
    viewer,
  );
  assert.ok(sharesCourt > 0);
  assert.ok(
    sharesCourt + 30 > everythingElse,
    "same court must be able to beat availability + confirmed + photo",
  );
});

test("the court comparison is normalised, so suffix variants still score", () => {
  for (const court of ["Penmar Recreation Center", "Penmar Rec Center", "Penmar Rec"]) {
    assert.ok(
      scorePlayer({ ...base, localCourts: [court] }, viewer) >= 40,
      `${court} should score the shared-court weight`,
    );
  }
});

test("shared availability accumulates", () => {
  const one = scorePlayer({ ...base, availability: ["Weekends"] }, viewer);
  const two = scorePlayer({ ...base, availability: ["Weekdays AM", "Weekends"] }, viewer);
  assert.equal(two - one, 8);
});

test("closeness of level scores, and tapers to nothing far away", () => {
  const same = scorePlayer({ ...base, level: "4.0" }, viewer);
  const near = scorePlayer({ ...base, level: "4.5" }, viewer);
  assert.ok(same > near, "an exact level beats half a rung away");
  assert.ok(near > scorePlayer({ ...base, level: "5.0" }, viewer), "and half beats a full rung");
  // Clamped at zero rather than going negative, so a distant level cannot drag a
  // player below someone with no level at all.
  assert.equal(scorePlayer({ ...base, level: "2.0" }, viewer), 0);
  assert.equal(scorePlayer({ ...base, level: "1.0" }, viewer), 0);
});

test("a confirmed rating breaks ties without outranking a court", () => {
  const confirmed = scorePlayer({ ...base, verified: true }, viewer);
  const court = scorePlayer({ ...base, localCourts: ["Penmar Rec"] }, viewer);
  assert.ok(confirmed > scorePlayer(base, viewer));
  assert.ok(court > confirmed);
});

test("no level on either side simply contributes nothing", () => {
  assert.doesNotThrow(() => scorePlayer({ ...base, level: "Unknown" }, viewer));
  assert.equal(scorePlayer({ ...base, level: "Unknown" }, { ...viewer, level: null }), 0);
});

/* ordering */

test("ranking is stable for equal scores", () => {
  const players = [
    { ...base, id: "a" },
    { ...base, id: "b" },
    { ...base, id: "c" },
  ];
  const ranked = rankPlayers(players as never, viewer) as unknown as Array<{ id: string }>;
  assert.deepEqual(ranked.map((p) => p.id), ["a", "b", "c"]);
});

test("the shared court sorts first", () => {
  const players = [
    { ...base, id: "far", level: "2.5" },
    { ...base, id: "court", localCourts: ["Penmar Rec"] },
    { ...base, id: "same-level" },
  ];
  const ranked = rankPlayers(players as never, viewer) as unknown as Array<{ id: string }>;
  assert.equal(ranked[0].id, "court");
});

/* the claim */

const curatable = {
  hasProfile: true,
  hasLevel: true,
  filtersUntouched: true,
  rankingRan: true,
  resultCount: 12,
};

test("the stamp renders only when every condition holds", () => {
  assert.equal(isCurated(curatable), true);
});

test("no stamp without a profile or a level", () => {
  // Nothing was curated FOR anyone, and the heaviest personal signal is missing.
  assert.equal(isCurated({ ...curatable, hasProfile: false }), false);
  assert.equal(isCurated({ ...curatable, hasLevel: false }), false);
});

test("no stamp once the user has set a filter", () => {
  // They are doing the choosing; we keep the ranking but stop calling it a reco.
  assert.equal(isCurated({ ...curatable, filtersUntouched: false }), false);
});

test("no stamp when the ranking did not actually run", () => {
  // A brand mark on an unranked list is the failure that costs more than shipping
  // nothing — it spends trust to say something untrue.
  assert.equal(isCurated({ ...curatable, rankingRan: false }), false);
});

test("no stamp when the result set is too small for order to mean anything", () => {
  assert.equal(isCurated({ ...curatable, resultCount: MIN_RANKABLE_RESULTS - 1 }), false);
  assert.equal(isCurated({ ...curatable, resultCount: MIN_RANKABLE_RESULTS }), true);
  assert.equal(isCurated({ ...curatable, resultCount: 0 }), false);
});
