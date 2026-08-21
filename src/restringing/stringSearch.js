import { FAMILY_KEYS, buildFamilyLadder, familyLabel } from "./families.js";

/**
 * Searching for a string, where the answer is never a dead end.
 *
 * The player searches what their stringer lists. When there is no match — and
 * with a thin catalog that is the common case, not the edge — the screen must
 * still offer a way forward: order the family the string belongs to and request
 * it by name. Every branch below ends in something tappable.
 *
 * Prices come from the family's service tier, never from the catalog row.
 * `restringing_vendor_strings.price_cents` is nullable and no endpoint writes
 * it, so a row's own price is absent by design: the family is what you buy.
 *
 * Availability is not modelled because it is not tracked — every listed string
 * is always available. Language here says "listed", never "in stock".
 */

/**
 * Well-known strings per family, used only to answer "what kind of string is
 * that?" when the player searches something nobody lists.
 *
 * This is a reference list, not a catalog: it never renders as something to
 * buy, and being absent from it only costs the player a more specific sentence.
 * Taken from the v5 prototype (docs/restring-flow-v5.html).
 */
const FAMILY_EXAMPLES = {
  syn_gut: ["Prince Synthetic Gut", "Head Syn Gut", "Gamma Synthetic Gut"],
  std_multi: ["Head MLT", "Prince Premier Touch", "Gamma Live Wire"],
  std_poly: ["Solinco Mach 10", "Head Lynx", "Signum Pro Poly Plasma"],
  prem_multi: ["Tecnifibre NRG2", "Wilson Sensation", "Babolat Xcel"],
  prem_poly: ["Luxilon ALU Power", "Solinco Hyper-G", "Babolat RPM Blast"],
  poly_multi: ["Head Gravity", "Hyper-G / X-Natural"],
  gut_poly: ["Wilson Champion's Choice", "Babolat VS / RPM"],
  nat_gut: ["Babolat VS Touch", "Wilson Natural Gut"],
};

export const ALL_FAMILIES = "all";

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();

/** What a player reads and types: "Solinco Hyper-G". */
export const stringTitle = (row) =>
  [clean(row?.brand), clean(row?.name)].filter(Boolean).join(" ");

const matchesQuery = (row, needle) => lower(stringTitle(row)).includes(needle);

/** Gauges the vendor will do for this string, narrowed to what the string has. */
export const rowGauges = (row) => {
  const stocked = Array.isArray(row?.gauges_stocked) ? row.gauges_stocked : [];
  const all = Array.isArray(row?.gauges) ? row.gauges : [];
  const usable = stocked.length ? stocked : all;
  return usable.map(clean).filter(Boolean);
};

/**
 * Catalog rows keyed to a family that we can actually price.
 *
 * A row whose category is not one of the eight, or whose family has no tier, is
 * dropped rather than shown at a guessed price — the same rule as the family
 * ladder. Silently omitting one string is better than selling it wrongly.
 */
export function decorateCatalog(catalog = [], tiers = [], options = {}) {
  const { families } = buildFamilyLadder(tiers, options);
  const byKey = new Map(families.map((family) => [family.key, family]));

  return (Array.isArray(catalog) ? catalog : [])
    .map((row) => {
      // Two shapes reach here. The raw endpoint returns `category`;
      // mergeTierCatalogs restamps it as `string_category` (falling back to the
      // tier it was fetched under), and that merged shape is what the screen
      // holds. Reading only one of them silently empties the whole catalog.
      const family = byKey.get(row?.string_category ?? row?.category);
      if (!family) return null;
      return {
        ...row,
        title: stringTitle(row),
        familyKey: family.key,
        familyLabel: family.label,
        priceCents: family.priceCents,
        tierId: family.tierId,
        gauges: rowGauges(row),
      };
    })
    .filter(Boolean);
}

/**
 * Family chips, only for families that have something listed.
 *
 * A chip that leads to an empty list is a dead tap, so families with nothing
 * listed are not offered here — they live one tap away on the full ladder.
 * The counts are what makes that promise checkable.
 */
export function familyChips(decorated = []) {
  const counts = new Map();
  (Array.isArray(decorated) ? decorated : []).forEach((row) => {
    counts.set(row.familyKey, (counts.get(row.familyKey) || 0) + 1);
  });

  return FAMILY_KEYS.filter((key) => counts.get(key) > 0).map((key) => ({
    key,
    label: familyLabel(key),
    count: counts.get(key),
  }));
}

/**
 * The family a searched string probably belongs to.
 *
 * Matches the query against the reference list in both directions, so both
 * "hyper" and a full "Solinco Hyper-G 17" find premium polyester. Returns null
 * rather than a guess when nothing matches — the miss path has copy for that.
 */
export function guessFamilyForQuery(query) {
  const needle = lower(query);
  if (needle.length < 2) return null;

  for (const key of FAMILY_KEYS) {
    const examples = FAMILY_EXAMPLES[key] || [];
    const hit = examples.some((example) => {
      const candidate = lower(example);
      return candidate.includes(needle) || needle.includes(candidate);
    });
    if (hit) return key;
  }
  return null;
}

/**
 * Everything the search screen needs, as one value.
 *
 * The component renders `mode` and nothing else decides. Modes:
 *
 *   listing   — no query yet; show what is listed
 *   results   — the query matched inside the active family
 *   elsewhere — matched, but only outside the active family; offer to widen
 *   miss      — matched nothing anywhere; offer the family by request
 *   empty     — nothing is listed at all, which is the state today
 *
 * `miss` and `empty` both carry a request the player can act on, so no branch
 * terminates. `requestFamily` is null only when the query resembles nothing we
 * know, and the screen then offers the full ladder instead.
 */
export function buildSearchView({
  catalog = [],
  tiers = [],
  query = "",
  family = ALL_FAMILIES,
  options = {},
} = {}) {
  const decorated = decorateCatalog(catalog, tiers, options);
  const chips = familyChips(decorated);
  const activeFamily = chips.some((chip) => chip.key === family) ? family : ALL_FAMILIES;
  const typed = clean(query);
  const needle = lower(query);

  const inFamily = (row) => activeFamily === ALL_FAMILIES || row.familyKey === activeFamily;
  const scoped = decorated.filter(inFamily);
  const results = typed ? scoped.filter((row) => matchesQuery(row, needle)) : scoped;
  const anywhere = typed ? decorated.filter((row) => matchesQuery(row, needle)) : [];

  const base = {
    chips,
    activeFamily,
    query: typed,
    totalListed: decorated.length,
    // The permanent way out, present in every mode: the families screen, with
    // whatever was typed carried through as the string request.
    requestQuery: typed,
  };

  if (!decorated.length) {
    return { ...base, mode: "empty", results: [], elsewhereCount: 0, requestFamily: guessFamilyForQuery(typed) };
  }

  if (results.length) {
    return {
      ...base,
      mode: typed ? "results" : "listing",
      results,
      elsewhereCount: 0,
      requestFamily: null,
    };
  }

  if (typed && anywhere.length) {
    return {
      ...base,
      mode: "elsewhere",
      results: [],
      elsewhereCount: anywhere.length,
      requestFamily: null,
    };
  }

  return {
    ...base,
    mode: typed ? "miss" : "listing",
    results: [],
    elsewhereCount: 0,
    requestFamily: typed ? guessFamilyForQuery(typed) : null,
  };
}

/**
 * The order line for a family ordered by request.
 *
 * The tier is what gets bought; the typed string rides along as
 * `custom_string_text`, which the backend already accepts and stores and the
 * vendor console already receives. Nothing here promises the string is
 * available — the copy says the stringer confirms at drop-off.
 */
export function buildFamilyRequest({ familyKey, query = "", tiers = [], options = {} }) {
  const { families } = buildFamilyLadder(tiers, options);
  const family = families.find((entry) => entry.key === familyKey);
  if (!family) return null;

  return {
    familyKey: family.key,
    familyLabel: family.label,
    tierId: family.tierId,
    priceCents: family.priceCents,
    customStringText: clean(query) || null,
  };
}
