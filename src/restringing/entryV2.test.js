import assert from "node:assert/strict";
import test from "node:test";

import { distanceLabel, lastRestring, nearbyStringers, orderAgainCard, reorderPlan, stringerTags } from "./entryV2.js";

const tiers = [
  { id: 1, name: "Restringing Only", price_cents: 2999, string_category: null },
  { id: 6, name: "Restringing + Premium Polyester", price_cents: 4999, string_category: "prem_poly" },
  { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: null, string_composition: "natural_gut" },
];

const restring = (overrides = {}) => ({
  item_type: "restring",
  service_tier_id: 6,
  string_id: 12,
  string_brand: "Solinco",
  string_name: "Hyper-G",
  gauge: "16L",
  tension_lbs_mains: "52.0",
  tension_lbs_crosses: "50.0",
  racket_make_model: "Babolat Pure Aero",
  unit_price_cents: 4499,
  ...overrides,
});

const order = (id, status, pickedUp, items = [restring()]) => ({
  id,
  vendor_id: 1,
  vendor_name: "The Tennis Garage",
  fulfillment_status: status,
  picked_up_at: pickedUp,
  created_at: pickedUp,
  items,
});

test("Order again uses the latest picked-up restring, not an open or cancelled one", () => {
  const latest = order(3, "picked_up", "2026-10-20T18:00:00Z", [restring({ racket_make_model: "Head Speed" })]);
  const orders = [
    order(1, "picked_up", "2026-09-01T18:00:00Z"),
    latest,
    order(4, "pending", "2026-11-01T18:00:00Z"),
    order(5, "cancelled", "2026-11-02T18:00:00Z"),
    order(6, "picked_up", "2026-11-03T18:00:00Z", [{ item_type: "racket", label: "New racket" }]),
  ];
  assert.equal(lastRestring(orders).order, latest);
  assert.equal(lastRestring([]), null);
  assert.equal(lastRestring(null), null);
});

test("the card shows today's price for the service, not what was paid", () => {
  const card = orderAgainCard(lastRestring([order(1, "picked_up", "2026-10-20T18:00:00Z")]), tiers);
  assert.equal(card.priceCents, 4999);
  assert.equal(card.string, "Solinco Hyper-G");
  assert.equal(card.tension, "52/50 lbs");
  assert.equal(card.racket, "Babolat Pure Aero");
  assert.equal(card.shop, "The Tennis Garage");
  assert.ok(card.date);
  // A service that's gone: no card rather than a made-up price.
  assert.equal(orderAgainCard(lastRestring([order(1, "picked_up", "2026-10-20T18:00:00Z", [restring({ service_tier_id: 99 })])]), tiers), null);
});

test("reorder keeps the string when the shop still stocks it", () => {
  const plan = reorderPlan({ item: restring(), tier: tiers[1], catalog: [{ id: 12, in_stock: true }, { id: 13 }] });
  assert.deepEqual(
    { stocked: plan.stocked, stringId: plan.stringId, gauge: plan.gauge, mains: plan.tensionMains, crosses: plan.tensionCrosses, split: plan.splitTension, racket: plan.racketMakeModel, tierId: plan.tierId },
    { stocked: true, stringId: "12", gauge: "16L", mains: 52, crosses: 50, split: true, racket: "Babolat Pure Aero", tierId: 6 },
  );
});

test("reorder sends the player to pick a string when theirs isn't stocked any more", () => {
  assert.equal(reorderPlan({ item: restring(), tier: tiers[1], catalog: [{ id: 13 }] }).stocked, false);
  assert.equal(reorderPlan({ item: restring(), tier: tiers[1], catalog: [{ id: 12, in_stock: false }] }).stocked, false);
});

test("reorder: own string, a described string, and a shop-chosen setup", () => {
  const own = reorderPlan({ item: restring({ service_tier_id: 1, string_id: null, own_string_text: "ALU Power 16L" }), tier: tiers[0] });
  assert.equal(own.ownString, "ALU Power 16L");
  assert.equal(own.stocked, true);
  assert.equal(reorderPlan({ item: restring({ service_tier_id: 1, string_id: null }), tier: tiers[0] }).stocked, false);

  const other = reorderPlan({ item: restring({ string_id: null, custom_string_text: "Tecnifibre X-One" }), tier: tiers[1], catalog: [] });
  assert.equal(other.stringId, "other");
  assert.equal(other.customString, "Tecnifibre X-One");

  const gut = reorderPlan({ item: restring({ service_tier_id: 9, string_id: null }), tier: tiers[2] });
  assert.equal(gut.stocked, true);
  assert.equal(gut.gauge, "");
});

test("reorder: same tension both ways isn't split, and advice stays advice", () => {
  const same = reorderPlan({ item: restring({ tension_lbs_crosses: "52" }), tier: tiers[1], catalog: [{ id: 12 }] });
  assert.equal(same.splitTension, false);
  const advice = reorderPlan({
    item: restring({ advice_requested: true, tension_lbs_mains: null, tension_lbs_crosses: null }),
    tier: tiers[1],
    catalog: [{ id: 12 }],
  });
  assert.equal(advice.adviceRequested, true);
  assert.equal(advice.tensionMains, 50);
});

test("stringers near you: within the radius when distances are known, every shop when not", () => {
  const near = { id: 1, distance_miles: 3.2 };
  const far = { id: 2, distance_miles: 40 };
  assert.deepEqual(nearbyStringers([near, far], 10), [near]);
  const noDistances = [{ id: 1, distance_miles: null }, { id: 2 }];
  assert.deepEqual(nearbyStringers(noDistances, 10), noDistances);
  assert.deepEqual(nearbyStringers([near, far], null), [near, far]);
  assert.equal(distanceLabel(near), "3.2 mi");
  assert.equal(distanceLabel({ distance_miles: null }), "");
});

test("stringer tags only say what the data backs", () => {
  assert.deepEqual(stringerTags({ turnaround_days: 3 }, { stringCount: 24, takesOwnString: true }), [
    "3-day turnaround",
    "24 strings in stock",
    "Bring your own string",
  ]);
  assert.deepEqual(stringerTags({}, {}), []);
  assert.deepEqual(stringerTags({ turnaround_days: 0 }, { stringCount: 1 }), ["1 string in stock"]);
});

test("Open now only while the shop's hours say so", () => {
  const hours = { mon: "09:00-17:00", tue: "09:00-17:00", wed: "09:00-17:00", thu: "09:00-17:00", fri: "09:00-17:00" };
  // Wed 5 Nov 2026, noon and 8 PM in Los Angeles.
  assert.deepEqual(stringerTags({ hours }, { now: new Date("2026-11-04T20:00:00Z") }), ["Open now"]);
  assert.deepEqual(stringerTags({ hours }, { now: new Date("2026-11-05T04:00:00Z") }), []);
});

test("the card's price is the shop's price for that string when it has one", () => {
  const entry = lastRestring([order(1, "picked_up", "2026-10-20T18:00:00Z")]);
  const stringId = entry.item.string_id;
  const priced = [{ id: stringId, string_price_cents: 2000, restring_price_cents: 4999 + 1 }];
  assert.equal(orderAgainCard(entry, tiers, priced).priceCents, 5000);
  // Not priced, or another string: the service's price.
  assert.equal(orderAgainCard(entry, tiers, [{ id: stringId, string_price_cents: null, restring_price_cents: null }]).priceCents, 4999);
  assert.equal(orderAgainCard(entry, tiers, [{ id: -1, string_price_cents: 2000, restring_price_cents: 5000 }]).priceCents, 4999);
});
