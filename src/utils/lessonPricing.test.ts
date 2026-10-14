import assert from "node:assert/strict";
import test from "node:test";

import { calculatePackagePricing } from "./lessonPricing";

test("a package adds the 3% card fee and the $1 booking fee to its price", () => {
  assert.deepEqual(calculatePackagePricing("100.00"), {
    packagePrice: 100,
    creditFee: 3,
    serviceFee: 1,
    total: 104,
  });
});

test("the card fee rounds to the cent like the backend charge", () => {
  // Backend: toCent(249.99) + toCent(7.4997) + toCent(1) = 24999 + 750 + 100.
  assert.equal(calculatePackagePricing(249.99).total, 258.49);
});

test("a missing price prices to just the booking fee", () => {
  assert.equal(calculatePackagePricing(null).packagePrice, 0);
});
