import assert from "node:assert/strict";
import test from "node:test";
import { findVendorBySlug, vendorProfilePath, vendorSlug } from "./vendorProfileRoutes.js";

test("vendorSlug makes a readable share slug from a store name", () => {
  assert.equal(vendorSlug("The Tennis Garage"), "thetennisgarage");
  assert.equal(vendorSlug("Racket & String Co."), "racketstringco");
});

test("findVendorBySlug matches vendors by generated name slug", () => {
  const vendors = [
    { id: 1, name: "Downtown Stringing" },
    { id: 2, name: "The Tennis Garage" },
  ];

  assert.deepEqual(findVendorBySlug(vendors, "thetennisgarage"), vendors[1]);
  assert.equal(findVendorBySlug(vendors, "missing"), null);
});

test("vendorProfilePath builds a shareable hash route path", () => {
  assert.equal(vendorProfilePath({ name: "The Tennis Garage" }), "/thetennisgarage");
});
