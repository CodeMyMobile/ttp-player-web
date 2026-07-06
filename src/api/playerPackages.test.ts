import test from "node:test";
import assert from "node:assert/strict";

import {
  getPackageCreditsRemaining,
  isActivePackagePurchase,
  isReservedPackagePurchase,
  type PackagePurchase,
} from "./playerPackages";

test("reserved package is not treated as active spendable credits", () => {
  const purchase: PackagePurchase = {
    id: 1,
    status: "reserved",
    paid: false,
    credits_remaining: 5,
  };

  assert.equal(isReservedPackagePurchase(purchase), true);
  assert.equal(isActivePackagePurchase(purchase), false);
  assert.equal(getPackageCreditsRemaining(purchase), 0);
});

test("paid package exposes spendable remaining credits", () => {
  const purchase: PackagePurchase = {
    id: 2,
    status: "partially_used",
    paid: true,
    credits_remaining: 3,
  };

  assert.equal(isReservedPackagePurchase(purchase), false);
  assert.equal(isActivePackagePurchase(purchase), true);
  assert.equal(getPackageCreditsRemaining(purchase), 3);
});
