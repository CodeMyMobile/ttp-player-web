import assert from "node:assert/strict";
import test from "node:test";

import { availableFilters, filterGroups, ownStringTier, pickSummary, stringGroups } from "./stringPicker.js";

const tiers = [
  { id: 1, name: "Restringing Only", price_cents: 2999, string_category: null, string_composition: null },
  { id: 2, name: "Restringing + Synthetic Gut", price_cents: 3999, string_category: "syn_gut" },
  { id: 4, name: "Restringing + Premium Multifilament", price_cents: 4999, string_category: "prem_multi" },
  { id: 6, name: "Restringing + Premium Polyester", price_cents: 4999, string_category: "prem_poly" },
  { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: null, string_composition: "natural_gut" },
];
const catalog = [
  { id: 13, brand: "Luxilon", name: "ALU Power", category: "prem_poly" },
  { id: 12, brand: "Solinco", name: "Hyper-G", category: "prem_poly" },
  { id: 10, brand: "Prince", name: "Synthetic Gut", category: "syn_gut" },
  { id: 20, brand: "Old", name: "Gone", category: "syn_gut", in_stock: false },
];

test("strings are grouped by category, priced at the category's service", () => {
  const groups = stringGroups(tiers, catalog);
  assert.deepEqual(groups.map((group) => [group.key, group.priceCents, group.strings.map((s) => s.id)]), [
    ["prem_poly", 4999, [13, 12]],
    ["syn_gut", 3999, [10]],
    ["natural_gut", 8999, []],
  ]);
  assert.equal(groups[0].label, "Premium Polyester");
  assert.ok(groups[0].blurb);
  assert.equal(groups[2].kind, "preset");
});

test("a category with nothing in stock isn't shown", () => {
  assert.equal(stringGroups(tiers, catalog).some((group) => group.key === "prem_multi"), false);
});

test("chips: only those with something to show, and each filters its groups", () => {
  const groups = stringGroups(tiers, catalog);
  assert.deepEqual(availableFilters(groups).map((chip) => chip.key), ["all", "poly", "syn", "gut"]);
  assert.deepEqual(filterGroups(groups, "poly").map((group) => group.key), ["prem_poly"]);
  assert.equal(filterGroups(groups, "all").length, 3);
});

test("Bring my own string is the labor-only service", () => {
  assert.equal(ownStringTier(tiers).id, 1);
  assert.equal(ownStringTier(tiers.slice(1)), null);
});

test("the sticky bar names the pick and its price", () => {
  const groups = stringGroups(tiers, catalog);
  assert.deepEqual(pickSummary({ kind: "string", tierId: 6, stringId: "12" }, groups, tiers), { title: "Solinco Hyper-G", priceCents: 4999 });
  assert.deepEqual(pickSummary({ kind: "preset", tierId: 9 }, groups, tiers), { title: "Natural gut", priceCents: 8999 });
  assert.deepEqual(pickSummary({ kind: "own", tierId: 1 }, groups, tiers), { title: "Your own string", priceCents: 2999 });
  assert.equal(pickSummary(null, groups, tiers), null);
  assert.equal(pickSummary({ kind: "string", tierId: 6, stringId: "99" }, groups, tiers), null);
});

test("production's hybrid and natural gut categories get their names, blurbs and the gut chip", () => {
  // As production has them: string categories with stocked strings, not compositions.
  const prodTiers = [
    { id: 7, name: "Restring + Poly / Multi Hybrid", price_cents: 4999, string_category: "poly_multi", string_composition: null },
    { id: 8, name: "Restring + Natural Gut Hybrid", price_cents: 6999, string_category: "gut_poly", string_composition: null },
    { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: "nat_gut", string_composition: null },
  ];
  const prodCatalog = [
    { id: 30, brand: "Solinco", name: "Hyper-G / X-Natural", category: "poly_multi" },
    { id: 31, brand: "Babolat", name: "VS Touch / RPM Blast", category: "gut_poly" },
    { id: 32, brand: "Babolat", name: "VS Touch", category: "nat_gut" },
  ];
  const groups = stringGroups(prodTiers, prodCatalog);
  assert.deepEqual(groups.map((group) => group.label), ["Poly / Multi Hybrid", "Natural Gut Hybrid", "Natural Gut"]);
  assert.ok(groups.every((group) => group.blurb));
  assert.equal(filterGroups(groups, "gut").length, 3);
  assert.deepEqual(availableFilters(groups).map((chip) => chip.key), ["all", "gut"]);
});

test("a category the app has no name for is named after its service, never a bare 'String'", () => {
  const groups = stringGroups(
    [{ id: 12, name: "Restringing + Kevlar", price_cents: 5999, string_category: "kevlar" }],
    [{ id: 40, brand: "Ashaway", name: "Crossfire", category: "kevlar" }],
  );
  assert.equal(groups[0].label, "Kevlar");
});
