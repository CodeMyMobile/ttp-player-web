/**
 * The eight string families — what a player actually buys.
 *
 * A family is a service tier: it sets the price. The specific string is a
 * *request* recorded against it, confirmed with the stringer at drop-off. That
 * is why this file resolves families and never prices them itself — every price
 * here comes from the tier row the API returned, or the family does not render.
 *
 * ## Why resolution never keys on tier id
 *
 * Tier ids are not stable across environments. Keying a family off `id === 7`
 * would silently resolve the wrong family — and therefore charge the wrong
 * price — the first time staging and production disagree. So resolution uses
 * `string_category` (a stable enum) and falls back to an exact tier-name match,
 * never an id and never a fuzzy match.
 *
 * ## Failing loudly
 *
 * A tier we cannot map is a bug, not a state to design around. `familyForTier`
 * throws in development so it surfaces the moment it appears, and returns null
 * in production so the family is *hidden* rather than shown blank or guessed.
 * Same for two tiers claiming one family: we cannot tell which price is right,
 * so nobody sees that family.
 *
 * ## The name fallback is now legacy
 *
 * Tiers 7, 8 and 9 shipped with `string_category: null` — the same value tier 1
 * (player supplies string) uses — so they were resolved by name instead. The
 * backend enum landed 2026-08-21 (ttp-api de27adb) and production now returns
 * poly_multi / gut_poly / nat_gut, so the name path is dead in production. It is
 * kept only until every environment has run that migration, then NAME_TO_FAMILY
 * and its tests can go.
 */

/** Order matters: this is the ladder as shown, cheapest family first. */
export const FAMILY_KEYS = [
  "syn_gut",
  "std_multi",
  "std_poly",
  "prem_multi",
  "prem_poly",
  "poly_multi",
  "gut_poly",
  "nat_gut",
];

const FAMILIES = {
  syn_gut: { label: "Synthetic gut", material: "syn_gut", blurb: "Reliable all-rounder" },
  std_multi: { label: "Standard multifilament", material: "multi", blurb: "Comfort and power" },
  std_poly: { label: "Standard polyester", material: "poly", blurb: "Spin and durability" },
  prem_multi: { label: "Premium multifilament", material: "multi", blurb: "Top comfort and feel" },
  prem_poly: { label: "Premium polyester", material: "poly", blurb: "Tour-level control" },
  poly_multi: { label: "Poly / multi hybrid", material: "hybrid", blurb: "Control with some give" },
  gut_poly: { label: "Natural gut hybrid", material: "hybrid", blurb: "Gut feel, poly bite" },
  nat_gut: { label: "Natural gut", material: "gut", blurb: "The best feel available" },
};

/**
 * Tier names as the API returns them today (checked 2026-08-20 against
 * /restringing/service-tiers). Used ONLY when a tier carries no
 * `string_category`. The match is exact after normalising case and whitespace —
 * a near miss is unmapped, not a guess, because guessing here mislabels a
 * player's order and charges them the wrong family's price.
 */
const NAME_TO_FAMILY = {
  "restringing + synthetic gut": "syn_gut",
  "restringing + standard multifilament": "std_multi",
  "restringing + standard polyester": "std_poly",
  "restringing + premium multifilament": "prem_multi",
  "restringing + premium polyester": "prem_poly",
  "restring + poly / multi hybrid": "poly_multi",
  "restring + natural gut hybrid": "gut_poly",
  "restring + natural gut": "nat_gut",
};

/**
 * The bring-your-own tier. It shares `string_category: null` with the three
 * unmapped families, so it has to be recognised explicitly — otherwise it looks
 * like a family we failed to map and would throw in dev on every load.
 */
const BYO_NAMES = new Set(["restringing only (player supplies string)"]);

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Vite defines import.meta.env; under `node --test` it is simply absent. */
const isDev = () => Boolean(import.meta.env?.DEV);

export class UnmappedTierError extends Error {
  constructor(message, tier) {
    super(message);
    this.name = "UnmappedTierError";
    this.tier = tier;
  }
}

export const familyLabel = (key) => FAMILIES[key]?.label || "";
export const familyMaterial = (key) => FAMILIES[key]?.material || null;
export const familyBlurb = (key) => FAMILIES[key]?.blurb || "";
export const isFamilyKey = (key) => Object.prototype.hasOwnProperty.call(FAMILIES, key);

/** True for the "player supplies string" tier, which is not a family. */
export function isByoTier(tier) {
  if (!tier) return false;
  return tier.string_category === null && BYO_NAMES.has(normalizeName(tier.name));
}

/**
 * The family key for a tier, or null when it cannot be resolved.
 *
 * @param {object} tier            a service tier row from the API
 * @param {object} [options]
 * @param {boolean} [options.strict]  throw instead of returning null.
 *   Defaults to dev, so an unmapped tier is impossible to miss while building
 *   and invisible to players in production.
 */
export function familyForTier(tier, { strict = isDev() } = {}) {
  if (!tier || typeof tier !== "object") {
    if (strict) throw new UnmappedTierError("Service tier is missing", tier);
    return null;
  }

  const category = tier.string_category;

  // A category we know is authoritative — it is the stable identifier.
  if (typeof category === "string" && category) {
    if (isFamilyKey(category)) return category;
    if (strict) {
      throw new UnmappedTierError(
        `Service tier ${tier.id} has unrecognised string_category "${category}". ` +
          `Expected one of: ${FAMILY_KEYS.join(", ")}.`,
        tier,
      );
    }
    return null;
  }

  // No category: BYO is a legitimate null, everything else falls to the name.
  if (isByoTier(tier)) return null;

  const byName = NAME_TO_FAMILY[normalizeName(tier.name)];
  if (byName) return byName;

  if (strict) {
    throw new UnmappedTierError(
      `Service tier ${tier.id} ("${tier.name}") has no string_category and no known name. ` +
        `Add it to NAME_TO_FAMILY, or have the backend set string_category.`,
      tier,
    );
  }
  return null;
}

const validPriceCents = (value) => {
  const cents = Number(value);
  return Number.isInteger(cents) && cents > 0 ? cents : null;
};

/**
 * The orderable family ladder, built from the tiers the API returned.
 *
 * Every entry carries a price that came from a tier row. A family whose tier is
 * missing, unmapped, priced oddly, or claimed by two tiers at once is left out
 * entirely — there is no blank price and no fallback constant anywhere in this
 * file, because a wrong price is a worse failure than an absent family.
 *
 * @returns {{ families: Array, byoTier: object|null, problems: Array }}
 *   `problems` is for diagnostics; nothing renders from it.
 */
export function buildFamilyLadder(tiers = [], { strict = isDev() } = {}) {
  const rows = Array.isArray(tiers) ? tiers : [];
  const problems = [];
  const byKey = new Map();
  let byoTier = null;

  rows.forEach((tier) => {
    if (isByoTier(tier)) {
      if (!byoTier) byoTier = tier;
      return;
    }

    let key = null;
    try {
      key = familyForTier(tier, { strict });
    } catch (err) {
      if (strict) throw err;
      key = null;
    }
    if (!key) {
      problems.push({ reason: "unmapped", tier });
      return;
    }

    const priceCents = validPriceCents(tier.price_cents);
    if (priceCents === null) {
      problems.push({ reason: "no_price", tier, key });
      if (strict) {
        throw new UnmappedTierError(
          `Service tier ${tier.id} ("${tier.name}") resolved to ${key} but has no usable price.`,
          tier,
        );
      }
      return;
    }

    const existing = byKey.get(key);
    if (existing) {
      // Two tiers, one family: we cannot tell which price is correct, so the
      // family is withheld rather than priced by whichever sorted first.
      byKey.set(key, null);
      problems.push({ reason: "duplicate", key, tiers: [existing?.tier, tier] });
      if (strict) {
        throw new UnmappedTierError(
          `Family "${key}" is claimed by more than one service tier ` +
            `(${existing?.tier?.id} and ${tier.id}). Only one may map to a family.`,
          tier,
        );
      }
      return;
    }

    byKey.set(key, {
      key,
      label: FAMILIES[key].label,
      material: FAMILIES[key].material,
      blurb: FAMILIES[key].blurb,
      tierId: tier.id,
      priceCents,
      tier,
    });
  });

  const families = FAMILY_KEYS.map((key) => byKey.get(key)).filter(Boolean);
  return { families, byoTier, problems };
}

/**
 * The tiers whose catalog is safe to request.
 *
 * Only tiers carrying a recognised `string_category`. This began as a guard
 * against a real bug: the catalog endpoint read the tier's `string_category`
 * and, when it was null, applied no category filter at all — so asking for
 * tier 7 returned the vendor's ENTIRE catalog relabelled as poly/multi hybrid.
 * That was fixed server-side on 2026-08-21 (ttp-api de27adb now returns an
 * empty catalog for a null-category tier).
 *
 * It stays for two reasons: it skips requests that cannot return anything
 * (tier 1 is bring-your-own, so it has no catalog by definition), and it still
 * refuses a tier whose category we do not recognise, which is the case a future
 * enum value would land in.
 *
 * Note this is not a stock check. Nothing tracks inventory — every listed
 * string is always available, and `in_stock` / `gauges_stocked` describe what a
 * vendor will do rather than what is on a shelf.
 */
export function tiersWithCatalog(tiers = []) {
  return (Array.isArray(tiers) ? tiers : []).filter(
    (tier) => tier && typeof tier.string_category === "string" && isFamilyKey(tier.string_category),
  );
}

/**
 * Families that are orderable but have no catalog to search — request-only.
 *
 * Empty in production now that every family carries a category. It stays
 * because an environment that has not run the enum migration still needs the
 * three hybrid families to be orderable rather than absent.
 */
export function requestOnlyFamilies(tiers = [], options = {}) {
  const { families } = buildFamilyLadder(tiers, options);
  const searchable = new Set(tiersWithCatalog(tiers).map((tier) => tier.string_category));
  return families.filter((family) => !searchable.has(family.key));
}
