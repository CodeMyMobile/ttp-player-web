import test from "node:test";
import assert from "node:assert/strict";

import {
  summarizeCredits,
  isPastPurchase,
  splitPurchases,
  resolvePurchaseName,
  formatPackageDate,
} from "./packageCredits.ts";

test("summarizeCredits totals credits across purchases", () => {
  const summary = summarizeCredits([
    { credits_total: 10, credits_used: 4, credits_remaining: 6 },
    { credits_total: 5, credits_used: 5, credits_remaining: 0 },
  ]);
  assert.equal(summary.total, 15);
  assert.equal(summary.used, 9);
  assert.equal(summary.remaining, 6);
});

test("summarizeCredits ignores non-numeric fields and missing values", () => {
  const summary = summarizeCredits([
    { credits_total: 8, credits_remaining: 8 },
    { credits_total: "oops", credits_remaining: undefined },
  ]);
  assert.equal(summary.total, 8);
  assert.equal(summary.remaining, 8);
  assert.equal(summary.used, 0);
});

test("summarizeCredits picks the earliest upcoming expiry", () => {
  const summary = summarizeCredits([
    { credits_remaining: 1, expires_at: "2026-09-01T00:00:00Z" },
    { credits_remaining: 2, expires_at: "2026-07-15T00:00:00Z" },
    { credits_remaining: 3, expires_at: null },
  ]);
  // Compare against the same formatter so the assertion is timezone-agnostic
  // (the earliest of the two dated purchases must win).
  assert.equal(summary.nextExpiry, formatPackageDate("2026-07-15T00:00:00Z"));
});

test("isPastPurchase: zero remaining credits is past", () => {
  assert.equal(isPastPurchase({ credits_remaining: 0 }), true);
});

test("isPastPurchase: undefined remaining is NOT treated as spent", () => {
  // No credits field, active status, no expiry -> still usable.
  assert.equal(isPastPurchase({ status: "active" }), false);
});

test("isPastPurchase: expired/used/cancelled status is past", () => {
  assert.equal(isPastPurchase({ status: "expired", credits_remaining: 3 }), true);
  assert.equal(isPastPurchase({ status: "used_up", credits_remaining: 3 }), true);
  assert.equal(isPastPurchase({ status: "cancelled", credits_remaining: 3 }), true);
});

test("isPastPurchase: expiry date in the past is past", () => {
  const now = new Date("2026-06-28T00:00:00Z").getTime();
  assert.equal(isPastPurchase({ credits_remaining: 5, expires_at: "2026-01-01T00:00:00Z" }, now), true);
  assert.equal(isPastPurchase({ credits_remaining: 5, expires_at: "2026-12-01T00:00:00Z" }, now), false);
});

test("splitPurchases separates active from past", () => {
  const now = new Date("2026-06-28T00:00:00Z").getTime();
  const { active, past } = splitPurchases(
    [
      { id: 1, credits_remaining: 5 },
      { id: 2, credits_remaining: 0 },
      { id: 3, credits_remaining: 2, expires_at: "2026-01-01T00:00:00Z" },
    ],
    now,
  );
  assert.deepEqual(active.map((p) => p.id), [1]);
  assert.deepEqual(past.map((p) => p.id), [2, 3]);
});

test("resolvePurchaseName prefers metadata name, then coach fallback", () => {
  assert.equal(resolvePurchaseName({ metadata: { name: "10-Pack" } }), "10-Pack");
  assert.equal(resolvePurchaseName({ metadata: { package_name: "Starter" } }), "Starter");
  assert.equal(resolvePurchaseName({}, "Coach Lee"), "Coach Lee · Lesson package");
  assert.equal(resolvePurchaseName({}), "Lesson package");
});
