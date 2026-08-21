import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_FAMILIES,
  buildFamilyRequest,
  buildSearchView,
  decorateCatalog,
  familyChips,
  guessFamilyForQuery,
  rowGauges,
  stringTitle,
} from "./stringSearch";

/** The live /restringing/service-tiers payload (2026-08-21). */
const TIERS = [
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
 * Catalog rows in the shape listVendorCatalog returns
 * (ttp-api models/restringing_catalog.js): note price_cents is null, because
 * nothing writes it — the family tier is what prices the row.
 */
const CATALOG = [
  { id: 10, brand: "Solinco", name: "Hyper-G", category: "prem_poly", material: "poly", gauges: ["16", "16L", "17"], gauges_stocked: ["16L", "17"], price_cents: null, in_stock: true },
  { id: 11, brand: "Luxilon", name: "ALU Power", category: "prem_poly", material: "poly", gauges: ["16L", "17"], gauges_stocked: ["16L"], price_cents: null, in_stock: true },
  { id: 12, brand: "Head", name: "Lynx Tour", category: "std_poly", material: "poly", gauges: ["16", "17"], gauges_stocked: ["17"], price_cents: null, in_stock: true },
  { id: 13, brand: "Prince", name: "Synthetic Gut", category: "syn_gut", material: "syn_gut", gauges: ["16", "17"], gauges_stocked: ["16", "17"], price_cents: null, in_stock: true },
];

const strict = { strict: true };
const view = (overrides = {}) =>
  buildSearchView({ catalog: CATALOG, tiers: TIERS, options: strict, ...overrides });

test("a row is priced by its family tier, never by its own null price", () => {
  const [hyperG] = decorateCatalog(CATALOG, TIERS, strict);

  assert.equal(hyperG.title, "Solinco Hyper-G");
  assert.equal(hyperG.familyKey, "prem_poly");
  assert.equal(hyperG.familyLabel, "Premium polyester");
  assert.equal(hyperG.priceCents, 4999, "from tier 6, not from row.price_cents (null)");
  assert.equal(hyperG.tierId, 6);
});

test("the merged catalog shape works, not just the raw endpoint shape", () => {
  // mergeTierCatalogs restamps `category` as `string_category` and it is that
  // merged array the screen holds — reading only `category` would leave the
  // search permanently empty while every test on raw rows still passed.
  const merged = CATALOG.map(({ category, ...row }) => ({
    ...row,
    string_category: category,
    tier_id: 6,
    price_cents: 4999,
    material: "poly",
  }));

  const decorated = decorateCatalog(merged, TIERS, strict);
  assert.equal(decorated.length, CATALOG.length);
  assert.equal(decorated[0].familyKey, "prem_poly");

  const result = buildSearchView({ catalog: merged, tiers: TIERS, query: "hyper", options: strict });
  assert.equal(result.mode, "results");
  assert.deepEqual(result.results.map((r) => r.title), ["Solinco Hyper-G"]);
});

test("a row whose family cannot be priced is dropped, not shown at a guess", () => {
  const rogue = [...CATALOG, { id: 99, brand: "Ghost", name: "Unknown", category: "kevlar", gauges: ["16"] }];

  assert.equal(decorateCatalog(rogue, TIERS, { strict: false }).length, CATALOG.length);
});

test("gauges narrow to what the vendor will do, falling back to the string's own", () => {
  assert.deepEqual(rowGauges({ gauges: ["16", "16L", "17"], gauges_stocked: ["16L", "17"] }), ["16L", "17"]);
  assert.deepEqual(rowGauges({ gauges: ["16", "17"], gauges_stocked: [] }), ["16", "17"]);
  assert.deepEqual(rowGauges({}), []);
});

test("chips appear only for families with something listed, and carry counts", () => {
  const chips = familyChips(decorateCatalog(CATALOG, TIERS, strict));

  assert.deepEqual(chips.map((c) => c.key), ["syn_gut", "std_poly", "prem_poly"]);
  assert.deepEqual(chips.map((c) => c.count), [1, 1, 2]);
  // No chip can lead to an empty list — that is the whole point of the rule.
  chips.forEach((chip) => {
    assert.ok(view({ family: chip.key }).results.length > 0, `${chip.key} chip must not dead-end`);
  });
});

test("chips follow the ladder order, not the order rows arrived in", () => {
  const shuffled = [...CATALOG].reverse();

  assert.deepEqual(
    familyChips(decorateCatalog(shuffled, TIERS, strict)).map((c) => c.key),
    ["syn_gut", "std_poly", "prem_poly"],
  );
});

test("no query lists everything", () => {
  const result = view();

  assert.equal(result.mode, "listing");
  assert.equal(result.results.length, 4);
  assert.equal(result.activeFamily, ALL_FAMILIES);
});

test("a query matches on brand and on model", () => {
  assert.deepEqual(view({ query: "hyper" }).results.map((r) => r.title), ["Solinco Hyper-G"]);
  assert.deepEqual(view({ query: "solinco" }).results.map((r) => r.title), ["Solinco Hyper-G"]);
  assert.deepEqual(view({ query: "  LYNX  " }).results.map((r) => r.title), ["Head Lynx Tour"]);
  assert.equal(view({ query: "hyper" }).mode, "results");
});

test("matches outside the active family offer to widen rather than showing nothing", () => {
  const result = view({ query: "hyper", family: "std_poly" });

  assert.equal(result.mode, "elsewhere");
  assert.deepEqual(result.results, []);
  assert.equal(result.elsewhereCount, 1);
  assert.equal(result.activeFamily, "std_poly", "the filter is still on, so the copy can name it");
});

test("a miss identifies the family and offers it by request", () => {
  const result = view({ query: "RPM Blast" });

  assert.equal(result.mode, "miss");
  assert.deepEqual(result.results, []);
  assert.equal(result.requestFamily, "prem_poly", "RPM Blast is a premium polyester");
  assert.equal(result.requestQuery, "RPM Blast", "the typed name rides along as the request");
});

test("a miss we cannot classify still offers a way forward", () => {
  const result = view({ query: "zzzz unknown string" });

  assert.equal(result.mode, "miss");
  assert.equal(result.requestFamily, null, "no guess rather than a wrong one");
  assert.equal(result.requestQuery, "zzzz unknown string", "the ladder still gets the query");
});

test("every mode carries a request the player can act on — no dead ends", () => {
  const cases = [
    view({ query: "hyper" }),
    view({ query: "hyper", family: "std_poly" }),
    view({ query: "RPM Blast" }),
    view({ query: "zzzz" }),
    buildSearchView({ catalog: [], tiers: TIERS, query: "hyper", options: strict }),
  ];

  cases.forEach((result) => {
    const actionable =
      result.results.length > 0 ||
      result.elsewhereCount > 0 ||
      Boolean(result.requestFamily) ||
      result.requestQuery.length > 0;
    assert.ok(actionable, `mode "${result.mode}" left the player with nothing to tap`);
  });
});

test("an empty catalog is a named mode, not an accidental miss", () => {
  // This is production today: zero rows for every tier.
  const result = buildSearchView({ catalog: [], tiers: TIERS, query: "hyper", options: strict });

  assert.equal(result.mode, "empty");
  assert.deepEqual(result.chips, [], "no chips, so nothing can dead-end");
  assert.equal(result.totalListed, 0);
  assert.equal(result.requestFamily, "prem_poly", "still identifies the family and offers it");
});

test("an empty catalog with no query still renders as empty, not listing", () => {
  const result = buildSearchView({ catalog: [], tiers: TIERS, options: strict });

  assert.equal(result.mode, "empty");
  assert.equal(result.requestFamily, null);
});

test("a family filter for something not listed falls back to all", () => {
  // Guards against a stale chip selection surviving a catalog change and
  // silently showing nothing.
  const result = view({ query: "", family: "nat_gut" });

  assert.equal(result.activeFamily, ALL_FAMILIES);
  assert.equal(result.results.length, 4);
});

test("guessFamilyForQuery matches partial and over-specified queries", () => {
  assert.equal(guessFamilyForQuery("alu power"), "prem_poly");
  assert.equal(guessFamilyForQuery("Luxilon ALU Power 125 16L"), "prem_poly", "extra detail still resolves");
  assert.equal(guessFamilyForQuery("VS Touch"), "nat_gut");
  assert.equal(guessFamilyForQuery("head mlt"), "std_multi");
  assert.equal(guessFamilyForQuery("z"), null, "one character is not a signal");
  assert.equal(guessFamilyForQuery(""), null);
  assert.equal(guessFamilyForQuery(null), null);
});

test("a family request carries the tier and the typed string, and promises nothing", () => {
  const request = buildFamilyRequest({ familyKey: "prem_poly", query: "  RPM Blast  ", tiers: TIERS, options: strict });

  assert.equal(request.tierId, 6);
  assert.equal(request.priceCents, 4999);
  assert.equal(request.customStringText, "RPM Blast");
  assert.equal(request.familyLabel, "Premium polyester");
});

test("a family request with no typed string sends null, not an empty string", () => {
  const request = buildFamilyRequest({ familyKey: "nat_gut", query: "   ", tiers: TIERS, options: strict });

  assert.equal(request.customStringText, null);
  assert.equal(request.tierId, 9);
});

test("a request for an unknown family is refused rather than priced", () => {
  assert.equal(buildFamilyRequest({ familyKey: "kevlar", tiers: TIERS, options: { strict: false } }), null);
});

test("malformed input degrades instead of throwing", () => {
  assert.equal(buildSearchView().mode, "empty");
  assert.equal(buildSearchView({ catalog: null, tiers: null, options: { strict: false } }).mode, "empty");
  assert.deepEqual(familyChips(null), []);
  assert.equal(stringTitle(null), "");
  assert.deepEqual(decorateCatalog(null, TIERS, strict), []);
});
