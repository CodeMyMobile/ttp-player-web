import assert from "node:assert/strict";
import test from "node:test";

import { spellNumber } from "../src/lib/numberWords.ts";

test("spells the counts these pages actually quote", () => {
  assert.equal(spellNumber(9), "nine");
  assert.equal(spellNumber(23), "twenty-three");
  assert.equal(spellNumber(20), "twenty");
  assert.equal(spellNumber(30), "thirty");
  assert.equal(spellNumber(45), "forty-five");
});

test("falls back to digits rather than printing undefined", () => {
  assert.equal(spellNumber(100), "100");
  assert.equal(spellNumber(137), "137");
  assert.equal(spellNumber(1.5), "1.5");
  assert.equal(spellNumber(-3), "-3");
});
