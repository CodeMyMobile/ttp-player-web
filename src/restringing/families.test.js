import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_KEYS,
  UnmappedTierError,
  buildFamilyLadder,
  familyForTier,
  isByoTier,
  requestOnlyFamilies,
  stockBearingTiers,
} from "./families";

/**
 * The live /restringing/service-tiers payload, copied verbatim on 2026-08-20.
 * Tiers 7-9 really do carry string_category: null in production — that is the
 * case this module exists to survive, so the fixture must not "fix" it.
 */
const LIVE_TIERS = [
  { id: 1, name: "Restringing Only (player supplies string)", price_cents: 2999, string_category: null },
  { id: 2, name: "Restringing + Synthetic Gut", price_cents: 3999, string_category: "syn_gut" },
  { id: 3, name: "Restringing + Standard Multifilament", price_cents: 4499, string_category: "std_multi" },
  { id: 5, name: "Restringing + Standard Polyester", price_cents: 4499, string_category: "std_poly" },
  { id: 4, name: "Restringing + Premium Multifilament", price_cents: 4999, string_category: "prem_multi" },
  { id: 6, name: "Restringing + Premium Polyester", price_cents: 4999, string_category: "prem_poly" },
  { id: 7, name: "Restring + Poly / Multi Hybrid", price_cents: 4999, string_category: null },
  { id: 8, name: "Restring + Natural Gut Hybrid", price_cents: 6999, string_category: null },
  { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: null },
];

const strict = { strict: true };
const lenient = { strict: false };

test("all eight families resolve from the live payload", () => {
  const { families, problems } = buildFamilyLadder(LIVE_TIERS, strict);

  assert.equal(families.length, 8);
  assert.deepEqual(families.map((f) => f.key), FAMILY_KEYS);
  assert.deepEqual(problems, []);
});

test("the three uncategorised tiers resolve by name, not by id", () => {
  assert.equal(familyForTier(LIVE_TIERS[6], strict), "poly_multi");
  assert.equal(familyForTier(LIVE_TIERS[7], strict), "gut_poly");
  assert.equal(familyForTier(LIVE_TIERS[8], strict), "nat_gut");
});

test("ids are never used to resolve a family", () => {
  // The same three families under completely different ids, as another
  // environment might number them. Resolution must not care.
  const renumbered = LIVE_TIERS.map((tier, index) => ({ ...tier, id: 900 + index }));
  const { families } = buildFamilyLadder(renumbered, strict);

  assert.deepEqual(families.map((f) => f.key), FAMILY_KEYS);
  assert.equal(families.find((f) => f.key === "nat_gut").tierId, 908);
});

test("a familiar id with an unfamiliar name does not inherit the old family", () => {
  // The hazard that motivated name-based resolution: id 7 means something else
  // in another environment.
  const impostor = { id: 7, name: "Restring + Kevlar Blend", price_cents: 5999, string_category: null };

  assert.throws(() => familyForTier(impostor, strict), UnmappedTierError);
  assert.equal(familyForTier(impostor, lenient), null);
});

test("bring-your-own is recognised, not treated as an unmapped family", () => {
  assert.equal(isByoTier(LIVE_TIERS[0]), true);
  assert.equal(familyForTier(LIVE_TIERS[0], strict), null, "BYO has no family, and that is not an error");

  const { byoTier, families } = buildFamilyLadder(LIVE_TIERS, strict);
  assert.equal(byoTier.id, 1);
  assert.ok(!families.some((f) => f.tierId === 1));
});

test("an unrecognised string_category throws in dev and hides in production", () => {
  const wrongEnum = { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: "natural_gut" };

  // The backend picking a different spelling must be loud, not silently ignored.
  assert.throws(() => familyForTier(wrongEnum, strict), UnmappedTierError);
  assert.equal(familyForTier(wrongEnum, lenient), null);
});

test("an unmapped tier is hidden in production rather than rendered blank", () => {
  const tiers = [...LIVE_TIERS, { id: 42, name: "Restring + Something New", price_cents: 5499, string_category: null }];
  const { families, problems } = buildFamilyLadder(tiers, lenient);

  assert.equal(families.length, 8, "the unknown tier is absent, the known eight are unaffected");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].reason, "unmapped");
});

test("a family claimed by two tiers is withheld, never priced by whichever came first", () => {
  const duplicated = [
    ...LIVE_TIERS,
    { id: 77, name: "Restringing + Standard Polyester", price_cents: 5999, string_category: "std_poly" },
  ];

  assert.throws(() => buildFamilyLadder(duplicated, strict), UnmappedTierError);

  const { families, problems } = buildFamilyLadder(duplicated, lenient);
  assert.ok(!families.some((f) => f.key === "std_poly"), "ambiguous price means no family at all");
  assert.equal(families.length, 7);
  assert.equal(problems.find((p) => p.reason === "duplicate").key, "std_poly");
});

test("every price comes from its tier row", () => {
  const { families } = buildFamilyLadder(LIVE_TIERS, strict);
  const byKey = Object.fromEntries(families.map((f) => [f.key, f]));

  assert.equal(byKey.syn_gut.priceCents, 3999);
  assert.equal(byKey.nat_gut.priceCents, 8999);
  assert.equal(byKey.gut_poly.priceCents, 6999);
  families.forEach((family) => {
    assert.equal(family.priceCents, family.tier.price_cents);
  });
});

test("a family with no usable price is dropped, not shown at zero", () => {
  const cases = [null, undefined, 0, -100, "free", Number.NaN];

  cases.forEach((price) => {
    const tiers = LIVE_TIERS.map((tier) =>
      tier.string_category === "syn_gut" ? { ...tier, price_cents: price } : tier,
    );
    const { families, problems } = buildFamilyLadder(tiers, lenient);

    assert.ok(!families.some((f) => f.key === "syn_gut"), `price ${String(price)} must not render`);
    assert.ok(problems.some((p) => p.reason === "no_price" || p.reason === "unmapped"));
  });
});

test("the ladder is ordered cheapest family first and holds that order", () => {
  const shuffled = [...LIVE_TIERS].reverse();
  const { families } = buildFamilyLadder(shuffled, strict);

  assert.deepEqual(families.map((f) => f.key), FAMILY_KEYS);
});

test("only tiers with a real category may be asked for stock", () => {
  // Guard, not tidying: the catalog endpoint applies NO category filter when
  // string_category is null, so asking for tier 7 returns the vendor's entire
  // stock labelled poly/multi. See families.js → stockBearingTiers.
  const stockable = stockBearingTiers(LIVE_TIERS);

  assert.deepEqual(stockable.map((t) => t.id), [2, 3, 5, 4, 6]);
  assert.ok(!stockable.some((t) => t.string_category === null));
  assert.ok(!stockable.some((t) => t.id === 1), "BYO must never be asked for a catalog either");
});

test("the uncategorised families are orderable by request but carry no stock", () => {
  const requestOnly = requestOnlyFamilies(LIVE_TIERS, strict);

  assert.deepEqual(requestOnly.map((f) => f.key), ["poly_multi", "gut_poly", "nat_gut"]);
  requestOnly.forEach((family) => assert.ok(family.priceCents > 0, "still priced, still orderable"));
});

test("empty, malformed and missing inputs degrade instead of throwing", () => {
  assert.deepEqual(buildFamilyLadder([], lenient).families, []);
  assert.deepEqual(buildFamilyLadder(null, lenient).families, []);
  assert.deepEqual(buildFamilyLadder(undefined, lenient).families, []);
  assert.deepEqual(buildFamilyLadder([null, undefined, "nope", 7], lenient).families, []);
  assert.equal(familyForTier(null, lenient), null);
  assert.equal(stockBearingTiers(null).length, 0);
});

test("tier names match regardless of case and stray whitespace", () => {
  const messy = { id: 9, name: "  RESTRING  +  Natural   Gut  ", price_cents: 8999, string_category: null };

  assert.equal(familyForTier(messy, strict), "nat_gut");
});

test("natural gut and natural gut hybrid are not confused for one another", () => {
  const gut = { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: null };
  const hybrid = { id: 8, name: "Restring + Natural Gut Hybrid", price_cents: 6999, string_category: null };

  assert.equal(familyForTier(gut, strict), "nat_gut");
  assert.equal(familyForTier(hybrid, strict), "gut_poly");
});
