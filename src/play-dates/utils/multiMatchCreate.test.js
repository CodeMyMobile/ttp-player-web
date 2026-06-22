import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAvailabilityShareMessage,
  mergeCreateResults,
  resolveShareHostId,
  summarizeResults,
} from "./multiMatchCreate.js";

const ok = (id) => ({ card: { id }, matchId: id * 100, ok: true });
const fail = (id) => ({ card: { id }, ok: false, error: "boom" });

test("first run: no prior results → fresh results pass through", () => {
  const merged = mergeCreateResults([], [ok(1), fail(2), ok(3)]);
  assert.deepEqual(
    merged.map((r) => [r.card.id, r.ok]),
    [
      [1, true],
      [2, false],
      [3, true],
    ],
  );
});

test("retry: a previously failed card that now succeeds replaces its old entry", () => {
  const previous = [ok(1), fail(2), ok(3)];
  const merged = mergeCreateResults(previous, [ok(2)]);
  // card 2 flips to ok; 1 and 3 preserved; no duplicates
  assert.equal(merged.filter((r) => r.card.id === 2).length, 1);
  assert.equal(merged.find((r) => r.card.id === 2).ok, true);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    summarizeResults(merged),
    { total: 3, succeeded: 3, failed: 0, allOk: true, anyFailed: false },
  );
});

test("retry that still fails keeps a single failed entry for that card", () => {
  const previous = [ok(1), fail(2)];
  const merged = mergeCreateResults(previous, [fail(2)]);
  assert.equal(merged.length, 2);
  assert.equal(merged.filter((r) => r.card.id === 2).length, 1);
  assert.equal(merged.find((r) => r.card.id === 2).ok, false);
});

test("untouched prior cards are preserved when retrying a subset", () => {
  const previous = [ok(1), fail(2), fail(3)];
  const merged = mergeCreateResults(previous, [ok(3)]);
  const byId = Object.fromEntries(merged.map((r) => [r.card.id, r.ok]));
  assert.deepEqual(byId, { 1: true, 2: false, 3: true });
});

test("summarizeResults reports counts and flags", () => {
  assert.deepEqual(summarizeResults([ok(1), ok(2), fail(3)]), {
    total: 3,
    succeeded: 2,
    failed: 1,
    allOk: false,
    anyFailed: true,
  });
  assert.deepEqual(summarizeResults([]), {
    total: 0,
    succeeded: 0,
    failed: 0,
    allOk: false,
    anyFailed: false,
  });
});

test("resolveShareHostId prefers the real player/user id over a profile row id", () => {
  assert.equal(
    resolveShareHostId({
      id: 2,
      user_id: 42,
      profile_id: 2,
      profile: { id: 2, user_id: 42 },
    }),
    42,
  );
});

test("resolveShareHostId uses user_id from profile data before top-level ids", () => {
  assert.equal(
    resolveShareHostId({
      id: 2,
      user_id: 99,
      profile: { id: 2, user_id: 42 },
    }),
    42,
  );
});

test("resolveShareHostId reads nested profile/player identity fields before generic id", () => {
  assert.equal(resolveShareHostId({ id: 2, profile: { player_id: 77 } }), 77);
  assert.equal(resolveShareHostId({ id: 2, player: { user_id: 88 } }), 88);
});

test("resolveShareHostId skips blank identity values", () => {
  assert.equal(resolveShareHostId({ user_id: null, profile: { user_id: "" }, id: 42 }), 42);
});

test("buildAvailabilityShareMessage formats one distinct match day", () => {
  assert.equal(
    buildAvailabilityShareMessage([
      { ok: true, card: { date: "2026-06-23" } },
      { ok: false, card: { date: "2026-06-24" } },
    ]),
    "Hey — looking to play Tue, grab a time 🎾",
  );
});

test("buildAvailabilityShareMessage formats two distinct match days", () => {
  assert.equal(
    buildAvailabilityShareMessage([
      { ok: true, card: { date: "2026-06-23" } },
      { ok: true, card: { date: "2026-06-27" } },
      { ok: true, card: { date: "2026-06-23" } },
    ]),
    "Hey — looking to play Tue & Sat, grab a time 🎾",
  );
});

test("buildAvailabilityShareMessage formats three or more distinct match days", () => {
  assert.equal(
    buildAvailabilityShareMessage([
      { ok: true, card: { date: "2026-06-23" } },
      { ok: true, card: { date: "2026-06-27" } },
      { ok: true, card: { date: "2026-06-28" } },
    ]),
    "Hey — looking to play Tue, Sat & Sun, grab a time 🎾",
  );
});

test("buildAvailabilityShareMessage falls back when no successful match days exist", () => {
  assert.equal(
    buildAvailabilityShareMessage([{ ok: false, card: { date: "2026-06-23" } }]),
    "I'm looking to play this week — take a look at what times I'm free 🎾",
  );
});
