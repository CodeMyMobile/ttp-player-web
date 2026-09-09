import assert from "node:assert/strict";
import test from "node:test";

import { byNewestPlayed, playedAtMs, scopeResults } from "./resultRows";
import type { ResultRow } from "./types";

const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  id: "r1",
  winnerName: "Winner",
  loserName: "Loser",
  score: "6–4 6–4",
  playedAgo: "recently",
  playedDate: "2026-03-10T17:00:00.000Z",
  isYours: false,
  ...over,
});

test("orders newest first", () => {
  const ordered = [
    row({ id: "old", playedDate: "2026-03-01T00:00:00.000Z" }),
    row({ id: "new", playedDate: "2026-03-20T00:00:00.000Z" }),
    row({ id: "mid", playedDate: "2026-03-10T00:00:00.000Z" }),
  ].sort(byNewestPlayed);

  assert.deepEqual(ordered.map((r) => r.id), ["new", "mid", "old"]);
});

/**
 * The bug this fixes: the API returns completed matches in no guaranteed order and the
 * tab rendered them as they arrived, so the list looked random.
 */
test("arrival order does not survive the sort", () => {
  const arrival = [
    row({ id: "a", playedDate: "2026-01-05T00:00:00.000Z" }),
    row({ id: "b", playedDate: "2026-06-05T00:00:00.000Z" }),
  ];
  assert.deepEqual([...arrival].sort(byNewestPlayed).map((r) => r.id), ["b", "a"]);
});

test("undated results sort last rather than first", () => {
  const ordered = [
    row({ id: "undated", playedDate: null }),
    row({ id: "dated", playedDate: "2026-03-01T00:00:00.000Z" }),
  ].sort(byNewestPlayed);

  assert.deepEqual(ordered.map((r) => r.id), ["dated", "undated"]);
});

/**
 * new Date(undefined).getTime() is NaN, and a comparator returning NaN leaves the array
 * in arrival order — i.e. silently reinstates the bug. Pinned so that cannot regress.
 */
test("an unparseable date is a number, never NaN", () => {
  for (const value of [null, undefined, "", "not a date"]) {
    const ms = playedAtMs(value);
    assert.equal(Number.isNaN(ms), false, `NaN for ${String(value)}`);
  }
  assert.equal(Number.isNaN(byNewestPlayed(row({ playedDate: "nonsense" }), row())), false);
});

test("equal timestamps keep their existing order", () => {
  const same = "2026-03-10T00:00:00.000Z";
  const ordered = [
    row({ id: "first", playedDate: same }),
    row({ id: "second", playedDate: same }),
  ].sort(byNewestPlayed);

  assert.deepEqual(ordered.map((r) => r.id), ["first", "second"]);
});

test("mine keeps the viewer's results, won or lost", () => {
  const rows = [
    row({ id: "won", isYours: true }),
    row({ id: "theirs", isYours: false }),
    row({ id: "lost", isYours: true }),
  ];

  assert.deepEqual(scopeResults(rows, "mine").map((r) => r.id), ["won", "lost"]);
  assert.deepEqual(scopeResults(rows, "all").map((r) => r.id), ["won", "theirs", "lost"]);
});

test("scoping does not reorder", () => {
  const rows = [
    row({ id: "a", isYours: true, playedDate: "2026-01-01T00:00:00.000Z" }),
    row({ id: "b", isYours: true, playedDate: "2026-09-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(scopeResults(rows, "mine").map((r) => r.id), ["a", "b"]);
});
