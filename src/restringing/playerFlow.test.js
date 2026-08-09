import assert from "node:assert/strict";
import { test } from "node:test";

import {
  brandsForMaterial,
  buildCheckoutItems,
  categoryLabel,
  deriveTier,
  filterCatalog,
  highlightMatch,
  isHybridCategory,
  lbsToKg,
  materialFromCategory,
  mergeTierCatalogs,
  normalizePaymentMethods,
  orderStatusLabel,
  paymentStatusLabel,
  recommendStringCategory,
  resolveReorderString,
} from "./playerFlow.js";

test("arm discomfort wins over affordable and never recommends polyester", () => {
  const result = recommendStringCategory({
    arm: "Yes",
    breaks: "Monthly+",
    priority: "Reliable & affordable",
    budget: "Good value",
  });

  assert.equal(result.category, "std_multi");
  assert.equal(result.tensionLbs, 52);
  assert.match(result.rationale, /arm-friendly/i);
});

test("converts pounds to one-decimal kilograms", () => {
  assert.equal(lbsToKg(54), "24.5");
  assert.equal(lbsToKg(50), "22.7");
});

test("advice requested nulls specs in checkout payload", () => {
  const items = buildCheckoutItems({
    serviceTierId: 4,
    selectedStringId: 12,
    racketMakeModel: "Wilson Blade 98",
    adviceRequested: true,
    gauge: "16",
    tensionMains: 54,
    tensionCrosses: 52,
    quantity: 2,
    setupMode: "same",
  });

  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    service_tier_id: 4,
    string_id: 12,
    custom_string_text: null,
    own_string_text: null,
    gauge: null,
    tension_lbs_mains: null,
    tension_lbs_crosses: null,
    advice_requested: true,
    racket_make_model: "Wilson Blade 98",
    notes: null,
  });
});

test("advice requested can defer vendor string choice", () => {
  const items = buildCheckoutItems({
    serviceTierId: 4,
    selectedStringId: null,
    customStringText: null,
    racketMakeModel: "Wilson Blade 98",
    adviceRequested: true,
    quantity: 1,
  });

  assert.equal(items[0].string_id, null);
  assert.equal(items[0].custom_string_text, null);
  assert.equal(items[0].gauge, null);
  assert.equal(items[0].tension_lbs_mains, null);
});

test("different per racket produces one order item per racket", () => {
  const items = buildCheckoutItems({
    serviceTierId: 5,
    selectedStringId: 21,
    quantity: 2,
    setupMode: "different",
    perRacketItems: [
      { racketMakeModel: "Head Speed MP", note: "red grip", stringId: 21, gauge: "16", tensionMains: 50 },
      { racketMakeModel: "Babolat Pure Aero", note: "blue grip", stringId: 22, gauge: "16L", tensionMains: 48 },
    ],
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].racket_make_model, "Head Speed MP");
  assert.equal(items[0].string_id, 21);
  assert.equal(items[0].tension_lbs_crosses, 50);
  assert.equal(items[1].racket_make_model, "Babolat Pure Aero");
  assert.equal(items[1].string_id, 22);
  assert.equal(items[1].notes, "blue grip");
});

test("normalizes saved payment method payloads with default first", () => {
  const methods = normalizePaymentMethods({
    data: [
      { id: "pm_old", card: { brand: "visa", last4: "4242", exp_month: 1, exp_year: 2030 } },
      { id: "pm_default", card: { brand: "mastercard", last4: "4444" } },
    ],
    default_payment_method_id: "pm_default",
  });

  assert.deepEqual(methods, [
    { id: "pm_default", brand: "mastercard", last4: "4444", expMonth: null, expYear: null, isDefault: true },
    { id: "pm_old", brand: "visa", last4: "4242", expMonth: 1, expYear: 2030, isDefault: false },
  ]);
});

test("labels restringing order and payment statuses for players", () => {
  assert.equal(orderStatusLabel("pending"), "Pending drop-off");
  assert.equal(orderStatusLabel("ready_for_pickup"), "Ready for pickup");
  assert.equal(orderStatusLabel("vendor_review"), "Vendor Review");
  assert.equal(paymentStatusLabel("unpaid"), "Awaiting payment");
  assert.equal(paymentStatusLabel("payment_failed"), "Payment failed");
});

test("derives a material bucket from the category slug, hybrids and new categories included", () => {
  assert.equal(materialFromCategory("std_poly"), "poly");
  assert.equal(materialFromCategory("prem_multi"), "multi");
  assert.equal(materialFromCategory("syn_gut"), "syn gut");
  assert.equal(materialFromCategory("natural_gut"), "nat gut");
  assert.equal(materialFromCategory("poly_multi_hybrid"), "hybrid");
  assert.equal(materialFromCategory("gut_poly_hybrid"), "hybrid");
  assert.equal(materialFromCategory(null), "own");
  assert.equal(isHybridCategory("gut_poly_hybrid"), true);
  assert.equal(isHybridCategory("std_poly"), false);
});

test("new categories render a titleized label until exact keys are set", () => {
  assert.equal(categoryLabel("std_poly"), "Standard Polyester");
  assert.equal(categoryLabel("natural_gut"), "Natural Gut");
  assert.equal(categoryLabel(null), "String");
});

test("merges per-tier catalogs, tagging category/price/material and de-duping by id", () => {
  const merged = mergeTierCatalogs([
    { tier: { id: 5, string_category: "std_poly", price_cents: 4499 }, catalog: [
      { id: 1, brand: "Head", name: "Lynx Tour" },
      { id: 2, brand: "Solinco", name: "Mach 10" },
    ] },
    { tier: { id: 4, string_category: "prem_multi", price_cents: 4999 }, catalog: [
      { id: 3, brand: "Tecnifibre", name: "NRG2" },
      { id: 1, brand: "Head", name: "Lynx Tour" }, // dupe id — dropped
    ] },
  ]);

  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((row) => [row.id, row.string_category, row.price_cents, row.material]),
    [[1, "std_poly", 4499, "poly"], [2, "std_poly", 4499, "poly"], [3, "prem_multi", 4999, "multi"]],
  );
});

test("brand list is scoped to the active material so filters never intersect to nothing", () => {
  const catalog = [
    { brand: "Head", material: "poly" },
    { brand: "Solinco", material: "poly" },
    { brand: "Tecnifibre", material: "multi" },
  ];
  assert.deepEqual(brandsForMaterial(catalog, "all"), ["Head", "Solinco", "Tecnifibre"]);
  assert.deepEqual(brandsForMaterial(catalog, "poly"), ["Head", "Solinco"]);
  assert.deepEqual(brandsForMaterial(catalog, "multi"), ["Tecnifibre"]);
});

test("filterCatalog ANDs query, material and brand", () => {
  const catalog = [
    { brand: "Head", name: "Lynx Tour", material: "poly" },
    { brand: "Solinco", name: "Hyper-G", material: "poly" },
    { brand: "Tecnifibre", name: "NRG2", material: "multi" },
  ];
  assert.equal(filterCatalog(catalog, { query: "hyper" }).length, 1);
  assert.equal(filterCatalog(catalog, { material: "poly" }).length, 2);
  assert.equal(filterCatalog(catalog, { material: "poly", brand: "Head" }).length, 1);
  assert.equal(filterCatalog(catalog, { query: "nrg", material: "poly" }).length, 0);
});

test("highlightMatch splits the first case-insensitive occurrence", () => {
  assert.deepEqual(highlightMatch("Solinco Hyper-G", "hyper"), [
    { text: "Solinco ", match: false },
    { text: "Hyper", match: true },
    { text: "-G", match: false },
  ]);
  assert.deepEqual(highlightMatch("Head Lynx", ""), [{ text: "Head Lynx", match: false }]);
  assert.deepEqual(highlightMatch("Head Lynx", "zzz"), [{ text: "Head Lynx", match: false }]);
});

test("deriveTier finds the tier whose category matches the string", () => {
  const tiers = [
    { id: 5, string_category: "std_poly" },
    { id: 6, string_category: "prem_poly" },
  ];
  assert.equal(deriveTier("prem_poly", tiers)?.id, 6);
  assert.equal(deriveTier("nope", tiers), null);
});

test("resolveReorderString exact-matches by id then brand+name, never fuzzy", () => {
  const catalog = [
    { id: 10, brand: "Solinco", name: "Hyper-G" },
    { id: 11, brand: "Head", name: "Lynx Tour" },
  ];
  // exact brand+name
  assert.equal(resolveReorderString({ string_brand: "Head", string_name: "Lynx Tour" }, catalog)?.id, 11);
  // id wins
  assert.equal(resolveReorderString({ string_id: 10, string_brand: "x", string_name: "y" }, catalog)?.id, 10);
  // near-miss is NOT fuzzy-matched
  assert.equal(resolveReorderString({ string_brand: "Head", string_name: "Lynx" }, catalog), null);
  // own/custom string (no name) resolves to null
  assert.equal(resolveReorderString({ own_string_text: "My gut 16" }, catalog), null);
});
