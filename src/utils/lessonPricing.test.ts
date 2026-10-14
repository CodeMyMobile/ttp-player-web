import assert from "node:assert/strict";
import test from "node:test";

import { calculatePackagePricing } from "./lessonPricing";

test("a package adds a 3.5% card fee and no booking fee", () => {
  assert.deepEqual(calculatePackagePricing("800.00"), {
    packagePrice: 800,
    creditFee: 28,
    total: 828,
  });
});

test("the card fee rounds to the cent like the backend charge", () => {
  // Backend: toCent(249.99) + toCent(8.74965) = 24999 + 875.
  assert.equal(calculatePackagePricing(249.99).total, 258.74);
});

test("a missing price prices to nothing", () => {
  assert.equal(calculatePackagePricing(null).total, 0);
});
