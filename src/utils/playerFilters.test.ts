import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activeChips,
  applyLabel,
  changedKeys,
  clearFilter,
  countNonDefault,
  filtersEqual,
  isServerSideKey,
  resetToDefaults,
  type PlayerFilterState,
} from "./playerFilters";

const DEFAULTS: PlayerFilterState = {
  radius: "10 mi",
  level: "All levels",
  gender: "All genders",
  playType: "All play types",
  availability: "All availability",
  verifiedOnly: false,
};

const ctx = { viewerLevel: "4.5", nearRange: ["4.0", "4.5", "5.0"] };

/* apply label — the gotcha */

test("the apply button counts when only client-side filters changed", () => {
  const draft = { ...DEFAULTS, gender: "Female", verifiedOnly: true };
  assert.equal(applyLabel(draft, DEFAULTS, 8), "Show 8 players");
  assert.equal(applyLabel(draft, DEFAULTS, 1), "Show 1 player");
  assert.equal(applyLabel(draft, DEFAULTS, 0), "Show 0 players");
});

test("the apply button drops the number when radius changed", () => {
  // Radius is resolved server-side, so there is no count to show until the request
  // returns. Never print a number we cannot back.
  const draft = { ...DEFAULTS, radius: "20 mi" };
  assert.equal(applyLabel(draft, DEFAULTS, 8), "Show results");
});

test("a mixed draft still drops the number", () => {
  // One server-side change is enough to make the whole count unknowable.
  const draft = { ...DEFAULTS, radius: "20 mi", gender: "Female" };
  assert.equal(applyLabel(draft, DEFAULTS, 8), "Show results");
});

test("an unchanged draft still counts", () => {
  assert.equal(applyLabel(DEFAULTS, DEFAULTS, 14), "Show 14 players");
});

test("radius is the server-side key and the others are not", () => {
  assert.equal(isServerSideKey("radius"), true);
  for (const key of ["level", "gender", "playType", "availability", "verifiedOnly"] as const) {
    assert.equal(isServerSideKey(key), false, `${key} should be client-side`);
  }
});

/* draft comparison */

test("filtersEqual and changedKeys agree", () => {
  assert.equal(filtersEqual(DEFAULTS, { ...DEFAULTS }), true);
  assert.deepEqual(changedKeys(DEFAULTS, { ...DEFAULTS }), []);
  const draft = { ...DEFAULTS, gender: "Female", radius: "20 mi" };
  assert.equal(filtersEqual(DEFAULTS, draft), false);
  assert.deepEqual(changedKeys(draft, DEFAULTS).sort(), ["gender", "radius"]);
});

test("the Filters button counts only non-default filters", () => {
  assert.equal(countNonDefault(DEFAULTS, DEFAULTS), 0);
  assert.equal(countNonDefault({ ...DEFAULTS, verifiedOnly: true }, DEFAULTS), 1);
  assert.equal(countNonDefault({ ...DEFAULTS, verifiedOnly: true, radius: "5 mi" }, DEFAULTS), 2);
});

/* chips */

test("only non-default filters get a chip", () => {
  assert.deepEqual(activeChips(DEFAULTS, DEFAULTS, ctx), []);
  const chips = activeChips({ ...DEFAULTS, gender: "Female" }, DEFAULTS, ctx);
  assert.deepEqual(chips, [{ key: "gender", label: "Female" }]);
});

test("the level chip carries the range it resolves to", () => {
  const chips = activeChips({ ...DEFAULTS, level: "Near your level" }, DEFAULTS, ctx);
  assert.deepEqual(chips, [{ key: "level", label: "Near your level · 4.0–5.0" }]);
});

test("no level chip when the viewer has no level", () => {
  // The chip is a claim that scoping is running. Without a level there is nothing to
  // scope against, so making the claim would be a lie.
  const chips = activeChips({ ...DEFAULTS, level: "Near your level" }, DEFAULTS, {
    viewerLevel: null,
    nearRange: [],
  });
  assert.deepEqual(chips, []);
});

test("the confirmed chip says ratings, not TPR", () => {
  const chips = activeChips({ ...DEFAULTS, verifiedOnly: true }, DEFAULTS, ctx);
  assert.deepEqual(chips, [{ key: "verifiedOnly", label: "Confirmed ratings" }]);
});

test("chips appear in a stable order regardless of the order they were set", () => {
  const a = activeChips({ ...DEFAULTS, verifiedOnly: true, radius: "5 mi" }, DEFAULTS, ctx);
  const b = activeChips({ ...DEFAULTS, radius: "5 mi", verifiedOnly: true }, DEFAULTS, ctx);
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((c) => c.key), ["radius", "verifiedOnly"]);
});

/* clearing */

test("clearing one chip touches only that constraint", () => {
  const state = { ...DEFAULTS, gender: "Female", verifiedOnly: true, radius: "5 mi" };
  const next = clearFilter(state, DEFAULTS, "gender");
  assert.equal(next.gender, DEFAULTS.gender);
  assert.equal(next.verifiedOnly, true, "other filters must survive");
  assert.equal(next.radius, "5 mi");
});

test("reset returns to the viewer's defaults, not to an empty state", () => {
  // The saved distance and level scoping come back; it is not "show me everything".
  const mine: PlayerFilterState = { ...DEFAULTS, radius: "5 mi", level: "Near your level" };
  const reset = resetToDefaults(mine);
  assert.deepEqual(reset, mine);
  assert.notEqual(reset.level, "All levels");
});
