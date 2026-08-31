import assert from "node:assert/strict";
import { test } from "node:test";

import * as playerFlow from "./playerFlow.js";
import {
  buildCheckoutItems,
  catalogGaugesForString,
  defaultGaugeForString,
  lbsToKg,
  normalizePaymentMethods,
  orderStatusLabel,
  paymentStatusLabel,
  recommendStringCategory,
  isPresetCompositionTier,
  serviceCompositionLabel,
  requiresVendorLogin,
  createSelection,
  nextScreenForVendor,
  wizardRecommendationFromAnswers,
} from "./playerFlow.js";

test("uses only a non-empty vendor image URL for card thumbnails", () => {
  assert.equal(playerFlow.vendorImageSrc({ image_url: " https://images.example.test/store.png " }), "https://images.example.test/store.png");
  assert.equal(playerFlow.vendorImageSrc({ image_url: " " }), "");
  assert.equal(playerFlow.vendorImageSrc(null), "");
});

test("requires authentication when a guest starts ordering with a vendor", () => {
  assert.equal(requiresVendorLogin(false), true);
  assert.equal(requiresVendorLogin(true), false);
});

test("keeps the reference selection mode through vendor choice", () => {
  assert.equal(nextScreenForVendor({ mode: "own" }), "rackets");
  assert.equal(nextScreenForVendor({ mode: "supplied", stringId: 9 }), "setup");
  assert.deepEqual(createSelection({ mode: "family", family: "std_multi", requestedText: "Lynx Tour" }), {
    mode: "family", stringId: null, family: "std_multi", requestedText: "Lynx Tour", ownStringText: "",
  });
});

test("completes the guided flow with a recommendation without waiting for the API", () => {
  assert.deepEqual(wizardRecommendationFromAnswers({
    arm: "soreness",
    game: "learning",
    break_frequency: "months",
    preference: "comfort_power",
  }), {
    category: "std_multi",
    categoryLabel: "Standard Multifilament",
    tensionLbs: 52,
  });
});

test("recognizes vendor-selected preset composition tiers", () => {
  assert.equal(isPresetCompositionTier({ string_category: null, string_composition: "poly_multi_hybrid" }), true);
  assert.equal(isPresetCompositionTier({ string_category: null, string_composition: "natural_gut_hybrid" }), true);
  assert.equal(isPresetCompositionTier({ string_category: null, string_composition: "natural_gut" }), true);
  assert.equal(isPresetCompositionTier({ string_category: null, string_composition: "unknown_composition" }), false);
  assert.equal(isPresetCompositionTier({ string_category: null, string_composition: null }), false);
});

test("labels included vendor-selected string compositions", () => {
  assert.equal(serviceCompositionLabel("poly_multi_hybrid"), "Polyester + Multifilament hybrid");
  assert.equal(serviceCompositionLabel("natural_gut_hybrid"), "Natural gut hybrid");
  assert.equal(serviceCompositionLabel("natural_gut"), "Natural gut");
});

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

test("uses selected catalog string gauges for ordering", () => {
  const lynx = { gauges: ["16", "17"], gauges_stocked: ["16", "18"] };
  const velocity = { gauges: ["17", "18"], gauges_stocked: ["18", "17"] };

  assert.deepEqual(catalogGaugesForString(lynx), ["16"]);
  assert.deepEqual(catalogGaugesForString(velocity), ["18", "17"]);
});

test("defaults gauge to 16 when stocked, otherwise first selected string gauge", () => {
  assert.equal(defaultGaugeForString({ gauges: ["17", "16"], gauges_stocked: ["17", "16"] }), "16");
  assert.equal(defaultGaugeForString({ gauges: ["17", "18"], gauges_stocked: ["17", "18"] }), "17");
  assert.equal(defaultGaugeForString(null), "16");
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
