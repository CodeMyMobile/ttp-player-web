import test from "node:test";
import assert from "node:assert/strict";

import { leaguePhotoIndex } from "./leaguePhotoMap.ts";

// The pure index mapping is tested here (not the imported asset URLs, which are build-hashed).

test("index is within the pool range", () => {
  for (let id = 1; id <= 50; id += 1) {
    const idx = leaguePhotoIndex(id, 4);
    assert.ok(idx >= 0 && idx < 4, `id ${id} → ${idx}`);
  }
});

test("index is deterministic for the same id", () => {
  assert.equal(leaguePhotoIndex(8, 4), leaguePhotoIndex(8, 4));
  assert.equal(leaguePhotoIndex("8", 4), leaguePhotoIndex(8, 4)); // string vs number id agree
});

test("empty pool → 0 (safe fallback, no divide-by-zero)", () => {
  assert.equal(leaguePhotoIndex(8, 0), 0);
});

test("distributes across the pool (not all the same slot)", () => {
  const seen = new Set<number>();
  for (let id = 1; id <= 40; id += 1) seen.add(leaguePhotoIndex(id, 4));
  assert.ok(seen.size > 1, "expected more than one slot used across 40 ids");
});
