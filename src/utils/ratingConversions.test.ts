import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveNtrp, deriveUtr } from "./ratingConversions";

/* The bug these guard against: Number(null) is 0, and 0 is finite, so the
   "no rating" branch never fired and the estimate formula ran on a zero that
   only ever meant "unknown". An unrated player displayed "UTR ~-5.0". */

test("no rating at all yields no rating — not an estimate built from zero", () => {
  for (const empty of [null, undefined, ""]) {
    assert.deepEqual(
      deriveUtr(empty, empty),
      { value: null, estimated: false },
      `UTR from ${JSON.stringify(empty)} must be null`,
    );
    assert.deepEqual(
      deriveNtrp(empty, empty),
      { value: null, estimated: false },
      `NTRP from ${JSON.stringify(empty)} must be null`,
    );
  }
});

test("a zero TPR is treated as unknown, not as a rating of zero", () => {
  assert.equal(deriveUtr(null, 0).value, null);
  assert.equal(deriveNtrp(null, 0).value, null);
});

test("no estimated UTR is ever negative or below the real floor", () => {
  // UTR starts at 1.0; anything under that is an artefact, not a rating.
  for (const tpr of [0, 0.5, 1, 1.5, 2, 2.5, 2.9]) {
    const { value } = deriveUtr(null, tpr);
    if (value !== null) {
      assert.ok(Number(value) >= 1.0, `TPR ${tpr} produced UTR ${value}`);
    }
  }
  assert.equal(deriveUtr(null, 2.5).value, null, "TPR 2.5 estimates UTR 0.0 — not a rating");
});

test("plausible TPRs still estimate as before", () => {
  assert.deepEqual(deriveUtr(null, 3.0), { value: "1.0", estimated: true });
  assert.deepEqual(deriveUtr(null, 4.0), { value: "3.0", estimated: true });
  assert.deepEqual(deriveUtr(null, 5.0), { value: "5.0", estimated: true });
});

test("a real direct rating still wins and is not flagged as estimated", () => {
  assert.deepEqual(deriveUtr(7.42, 4.0), { value: "7.4", estimated: false });
  assert.deepEqual(deriveNtrp(4.5, 4.0), { value: "4.50", estimated: false });
});

test("a direct rating survives even when the TPR is missing", () => {
  assert.deepEqual(deriveUtr(6.1, null), { value: "6.1", estimated: false });
  assert.deepEqual(deriveNtrp(3.5, null), { value: "3.50", estimated: false });
});

test("nonsense input is rejected rather than coerced", () => {
  assert.equal(deriveUtr("abc", "abc").value, null);
  assert.equal(deriveNtrp("abc", "abc").value, null);
});

test("NTRP estimates stay inside the real scale", () => {
  for (const tpr of [3, 4, 5, 6, 7, 9]) {
    const { value } = deriveNtrp(null, tpr);
    assert.ok(value !== null);
    const n = Number(value);
    assert.ok(n >= 2.5 && n <= 6.0, `TPR ${tpr} produced NTRP ${value}`);
  }
});
