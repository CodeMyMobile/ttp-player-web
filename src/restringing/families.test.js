import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_KEYS,
  UnmappedTierError,
  buildFamilyLadder,
  familyForTier,
  isByoTier,
  requestOnlyFamilies,
  tiersWithCatalog,
} from "./families";

/**
 * The live /restringing/service-tiers payload, copied verbatim on 2026-08-21,
 * after ttp-api de27adb set the hybrid categories. This is what production
 * returns now, so it is what the drift guard pins.
 */
const LIVE_TIERS = [
  { id: 1, name: "Restringing Only (player supplies string)", price_cents: 2999, string_category: null },
  { id: 2, name: "Restringing + Synthetic Gut", price_cents: 3999, string_category: "syn_gut" },
  { id: 3, name: "Restringing + Standard Multifilament", price_cents: 4499, string_category: "std_multi" },
  { id: 5, name: "Restringing + Standard Polyester", price_cents: 4499, string_category: "std_poly" },
  { id: 4, name: "Restringing + Premium Multifilament", price_cents: 4999, string_category: "prem_multi" },
  { id: 6, name: "Restringing + Premium Polyester", price_cents: 4999, string_category: "prem_poly" },
  { id: 7, name: "Restring + Poly / Multi Hybrid", price_cents: 4999, string_category: "poly_multi" },
  { id: 8, name: "Restring + Natural Gut Hybrid", price_cents: 6999, string_category: "gut_poly" },
  { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: "nat_gut" },
];

/**
 * The same payload BEFORE the enum landed, when tiers 7-9 carried
 * string_category: null. Environments that have not run the migration still
 * return this, and NAME_TO_FAMILY still exists to handle it — so it stays
 * covered until that fallback is deleted.
 */
const LEGACY_TIERS = LIVE_TIERS.map((tier) =>
  ["poly_multi", "gut_poly", "nat_gut"].includes(tier.string_category)
    ? { ...tier, string_category: null }
    : tier,
);

const strict = { strict: true };
const lenient = { strict: false };

/**
 * Eight families, plus tier 1 (bring your own) which is not a family. If the
 * API grows, renames or drops a tier, these numbers stop matching and the drift
 * guard below fails — which is the point.
 */
const EXPECTED_FAMILIES = 8;
const EXPECTED_BYO_TIERS = 1;

test("drift guard: every live tier resolves to exactly one known family", () => {
  const claimedBy = new Map();
  const unresolved = [];
  let byoCount = 0;

  LIVE_TIERS.forEach((tier) => {
    if (isByoTier(tier)) {
      byoCount += 1;
      return;
    }

    const key = familyForTier(tier, strict);
    if (!key) {
      unresolved.push(`${tier.id} "${tier.name}"`);
      return;
    }

    assert.ok(FAMILY_KEYS.includes(key), `tier ${tier.id} resolved to unknown family "${key}"`);
    assert.equal(
      claimedBy.has(key),
      false,
      `family "${key}" is claimed by tier ${claimedBy.get(key)} and tier ${tier.id}`,
    );
    claimedBy.set(key, tier.id);
  });

  assert.deepEqual(unresolved, [], "every non-BYO tier must resolve to a family");
  assert.equal(byoCount, EXPECTED_BYO_TIERS, "exactly one bring-your-own tier");
  assert.equal(claimedBy.size, EXPECTED_FAMILIES, "one tier per family, no family left unclaimed");

  // The three views of the same number must agree: what the module declares,
  // what the fixture resolves to, and what the ladder actually renders.
  assert.equal(FAMILY_KEYS.length, EXPECTED_FAMILIES);
  assert.equal(buildFamilyLadder(LIVE_TIERS, strict).families.length, EXPECTED_FAMILIES);
  assert.equal(LIVE_TIERS.length, EXPECTED_FAMILIES + EXPECTED_BYO_TIERS);
});

test("all eight families resolve from the live payload", () => {
  const { families, problems } = buildFamilyLadder(LIVE_TIERS, strict);

  assert.equal(families.length, 8);
  assert.deepEqual(families.map((f) => f.key), FAMILY_KEYS);
  assert.deepEqual(problems, []);
});

test("production resolves the hybrid families by their category enum", () => {
  assert.equal(familyForTier(LIVE_TIERS[6], strict), "poly_multi");
  assert.equal(familyForTier(LIVE_TIERS[7], strict), "gut_poly");
  assert.equal(familyForTier(LIVE_TIERS[8], strict), "nat_gut");
});

test("legacy: an uncategorised tier still resolves by name, not by id", () => {
  // Until every environment has run ttp-api de27adb.
  assert.equal(familyForTier(LEGACY_TIERS[6], strict), "poly_multi");
  assert.equal(familyForTier(LEGACY_TIERS[7], strict), "gut_poly");
  assert.equal(familyForTier(LEGACY_TIERS[8], strict), "nat_gut");
  assert.deepEqual(buildFamilyLadder(LEGACY_TIERS, strict).families.map((f) => f.key), FAMILY_KEYS);
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

test("every family tier is searchable, and bring-your-own never is", () => {
  const searchable = tiersWithCatalog(LIVE_TIERS);

  assert.equal(searchable.length, 8, "all eight families carry a catalog now");
  assert.ok(!searchable.some((t) => t.id === 1), "BYO has no catalog by definition");
});

test("legacy: an uncategorised tier is not asked for a catalog", () => {
  // It would have returned the vendor's entire catalog relabelled as that
  // family before ttp-api de27adb; the client refuses to ask regardless.
  const searchable = tiersWithCatalog(LEGACY_TIERS);

  assert.deepEqual(searchable.map((t) => t.id), [2, 3, 5, 4, 6]);
  assert.ok(!searchable.some((t) => t.string_category === null));
});

test("nothing is request-only in production now that every family has a category", () => {
  assert.deepEqual(requestOnlyFamilies(LIVE_TIERS, strict), []);
});

test("legacy: uncategorised families stay orderable by request", () => {
  const requestOnly = requestOnlyFamilies(LEGACY_TIERS, strict);

  assert.deepEqual(requestOnly.map((f) => f.key), ["poly_multi", "gut_poly", "nat_gut"]);
  requestOnly.forEach((family) => assert.ok(family.priceCents > 0, "still priced, still orderable"));
});

test("empty, malformed and missing inputs degrade instead of throwing", () => {
  assert.deepEqual(buildFamilyLadder([], lenient).families, []);
  assert.deepEqual(buildFamilyLadder(null, lenient).families, []);
  assert.deepEqual(buildFamilyLadder(undefined, lenient).families, []);
  assert.deepEqual(buildFamilyLadder([null, undefined, "nope", 7], lenient).families, []);
  assert.equal(familyForTier(null, lenient), null);
  assert.equal(tiersWithCatalog(null).length, 0);
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
