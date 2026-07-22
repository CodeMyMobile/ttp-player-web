import test from "node:test";
import assert from "node:assert/strict";

import { rankMedal, ordinal } from "./leagueMedal.ts";

test("rank 1 → gold trophy, 'Won it'", () => {
  const m = rankMedal(1);
  assert.equal(m.emoji, "🏆");
  assert.equal(m.className, "gold");
  assert.equal(m.label, "Won it");
});

test("ranks 2 and 3 → bronze with ordinal label", () => {
  assert.equal(rankMedal(2).className, "bronze");
  assert.equal(rankMedal(2).label, "2nd");
  assert.equal(rankMedal(3).className, "bronze");
  assert.equal(rankMedal(3).label, "3rd");
});

test("ranks 4+ → plain ball with ordinal", () => {
  const m = rankMedal(7);
  assert.equal(m.emoji, "🎾");
  assert.equal(m.className, "");
  assert.equal(m.label, "7th");
});

test("unknown / non-positive rank → neutral dash (pre-season / no standings)", () => {
  assert.equal(rankMedal(null).label, "—");
  assert.equal(rankMedal(0).label, "—");
  assert.equal(rankMedal("abc").label, "—");
  assert.equal(rankMedal(undefined).className, "");
});

test("rank accepts numeric strings from the API", () => {
  assert.equal(rankMedal("1").label, "Won it");
  assert.equal(rankMedal("11").label, "11th");
});

test("ordinal handles the 11-13 exceptions", () => {
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(12), "12th");
  assert.equal(ordinal(13), "13th");
  assert.equal(ordinal(21), "21st");
});
