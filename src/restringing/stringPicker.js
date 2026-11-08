// Pure helpers for "I know what I want" (VITE_RESTRING_V2): the shop's in-stock strings,
// grouped by category. A string the shop has priced costs labor plus the string; the rest
// cost their service's price (what checkout charges either way).
import { categoryLabel, categoryPrice, restringUnitPrice, serviceCompositionLabel } from "./playerFlow.js";

// One line per category. App copy: the catalog has no description of a category.
const CATEGORY_BLURBS = {
  syn_gut: "Reliable all-rounder at the best price.",
  std_multi: "Soft and powerful; easy on the arm.",
  prem_multi: "The most comfortable feel short of natural gut.",
  std_poly: "Spin and durability for big hitters.",
  prem_poly: "Tour-level spin and control; firm on the arm.",
  poly_multi_hybrid: "Polyester mains for control, multifilament crosses for comfort.",
  natural_gut_hybrid: "Natural gut feel with polyester durability.",
  natural_gut: "The softest, most powerful string there is.",
};
// In production the hybrid and natural gut services are string categories, with strings the
// shop stocks; older data has them as compositions, where the shop picks. Same copy for both.
CATEGORY_BLURBS.poly_multi = CATEGORY_BLURBS.poly_multi_hybrid;
CATEGORY_BLURBS.gut_poly = CATEGORY_BLURBS.natural_gut_hybrid;
CATEGORY_BLURBS.nat_gut = CATEGORY_BLURBS.natural_gut;

const GUT_AND_HYBRIDS = ["poly_multi_hybrid", "natural_gut_hybrid", "natural_gut", "poly_multi", "gut_poly", "nat_gut"];

/** Filter chips, and which groups each covers. */
export const STRING_FILTERS = [
  { key: "all", label: "All" },
  { key: "poly", label: "Polyester", categories: ["std_poly", "prem_poly"] },
  { key: "multi", label: "Multifilament", categories: ["std_multi", "prem_multi"] },
  { key: "syn", label: "Synthetic gut", categories: ["syn_gut"] },
  { key: "gut", label: "Natural gut & hybrids", categories: GUT_AND_HYBRIDS },
];

// Order on the page: firmest strings first, softest last.
const CATEGORY_ORDER = [
  "prem_poly", "std_poly", "prem_multi", "std_multi", "syn_gut",
  "poly_multi", "poly_multi_hybrid", "gut_poly", "natural_gut_hybrid", "nat_gut", "natural_gut",
];
const orderOf = (key) => (CATEGORY_ORDER.includes(key) ? CATEGORY_ORDER.indexOf(key) : CATEGORY_ORDER.length);

// A category the app has no name for still gets one: its service's name without the
// "Restring(ing) +" prefix, rather than a bare "String".
const groupLabel = (tier, known) =>
  known !== "String" ? known : String(tier?.name || "").replace(/^restring(ing)?\s*\+\s*/i, "").trim() || known;

const isOwnTier = (tier) => tier && tier.string_category == null && !tier.string_composition;

/**
 * The groups to show: one per category with strings in stock at the shop, one per preset
 * (natural gut / hybrid) service, where the shop picks the strings. Each carries its lowest
 * price, with `varies` when its strings cost different amounts (shown as "from"), and each
 * string its own price. Categories with nothing in stock are left out rather than shown empty.
 */
export function stringGroups(tiers, catalog) {
  const rows = Array.isArray(catalog) ? catalog.filter((row) => row && row.in_stock !== false) : [];
  const groups = [];
  (Array.isArray(tiers) ? tiers : []).forEach((tier) => {
    if (tier.string_category) {
      const strings = rows
        .filter((row) => row.category === tier.string_category)
        .sort((left, right) => `${left.brand} ${left.name}`.localeCompare(`${right.brand} ${right.name}`))
        .map((row) => ({ ...row, priceCents: restringUnitPrice(tier, row).unitCents }));
      if (!strings.length) return;
      const { priceCents, varies } = categoryPrice(tier, strings);
      groups.push({
        key: tier.string_category,
        tierId: tier.id,
        kind: "string",
        label: groupLabel(tier, categoryLabel(tier.string_category)),
        blurb: CATEGORY_BLURBS[tier.string_category] || "",
        priceCents,
        varies,
        strings,
      });
    } else if (tier.string_composition) {
      groups.push({
        key: tier.string_composition,
        tierId: tier.id,
        kind: "preset",
        label: groupLabel(
          tier,
          serviceCompositionLabel(tier.string_composition) === "Included strings" ? "String" : serviceCompositionLabel(tier.string_composition),
        ),
        blurb: CATEGORY_BLURBS[tier.string_composition] || "",
        priceCents: Number(tier.price_cents) || 0,
        varies: false,
        strings: [],
      });
    }
  });
  return groups.sort((left, right) => orderOf(left.key) - orderOf(right.key));
}

/** The labor-only service, for "Bring my own string"; null when the shop has none. */
export const ownStringTier = (tiers) => (Array.isArray(tiers) ? tiers : []).find(isOwnTier) || null;

/** The groups a chip shows. */
export function filterGroups(groups, filterKey) {
  const filter = STRING_FILTERS.find((item) => item.key === filterKey);
  if (!filter?.categories) return groups;
  return groups.filter((group) => filter.categories.includes(group.key));
}

/** Only the chips that would show something, "All" always. */
export const availableFilters = (groups) =>
  STRING_FILTERS.filter((filter) => !filter.categories || filterGroups(groups, filter.key).length > 0);

/**
 * What the sticky bar says about a pick: { title, priceCents }. A pick is
 * { kind: "string", tierId, stringId } | { kind: "preset", tierId } | { kind: "own", tierId }.
 */
export function pickSummary(pick, groups, tiers) {
  if (!pick) return null;
  if (pick.kind === "own") {
    const tier = (Array.isArray(tiers) ? tiers : []).find((row) => Number(row.id) === Number(pick.tierId));
    return tier ? { title: "Your own string", priceCents: Number(tier.price_cents) || 0 } : null;
  }
  const group = groups.find((row) => Number(row.tierId) === Number(pick.tierId));
  if (!group) return null;
  if (pick.kind === "preset") return { title: group.label, priceCents: group.priceCents };
  const string = group.strings.find((row) => String(row.id) === String(pick.stringId));
  return string ? { title: `${string.brand} ${string.name}`.trim(), priceCents: string.priceCents } : null;
}
