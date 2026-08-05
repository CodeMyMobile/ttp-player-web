import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCheckoutItems,
  lbsToKg,
  recommendStringCategory,
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
