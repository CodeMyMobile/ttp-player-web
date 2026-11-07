// Pure helpers for the redesigned restring entry page (VITE_RESTRING_V2): the "Order again"
// card, rebuilding an order from it, and the "Stringers near you" list.
import { formatShopDate, formatTension, itemStringName } from "./myOrders.js";
import { vendorOpenStatus } from "./vendorPage.js";

const clean = (value) => String(value || "").trim();
const COMPLETED_STATUSES = ["picked_up", "fulfilled"];
const statusOf = (order) => clean(order?.fulfillment_status).toLowerCase();
const timeOf = (order) =>
  new Date(order?.picked_up_at || order?.fulfilled_at || order?.created_at || 0).getTime() || 0;

const isRestringItem = (item) => item?.item_type !== "custom" && item?.item_type !== "racket" && Boolean(item?.service_tier_id);

/**
 * The player's most recent picked-up restring: { order, item }, or null. "Most recent", not
 * "most frequent" (that's usualSetup), because the card offers to repeat the last job.
 */
export function lastRestring(orders) {
  let best = null;
  (Array.isArray(orders) ? orders : [])
    .filter((order) => COMPLETED_STATUSES.includes(statusOf(order)))
    .forEach((order) => {
      const item = (Array.isArray(order.items) ? order.items : []).find(isRestringItem);
      if (!item) return;
      const time = timeOf(order);
      if (!best || time > best.time) best = { order, item, time };
    });
  return best ? { order: best.order, item: best.item } : null;
}

/**
 * What the "Order again" card shows. The price is today's price for that service, not what
 * was paid last time: that's what Reorder will charge. Null when the service no longer exists.
 */
export function orderAgainCard(entry, tiers) {
  if (!entry) return null;
  const { order, item } = entry;
  const tier = (Array.isArray(tiers) ? tiers : []).find((row) => Number(row.id) === Number(item.service_tier_id));
  if (!tier) return null;
  return {
    racket: clean(item.racket_make_model) || "Your racket",
    string: itemStringName(item),
    tension: item.advice_requested && !formatTension(item.tension_lbs_mains, item.tension_lbs_crosses)
      ? "Stringer’s choice tension"
      : formatTension(item.tension_lbs_mains, item.tension_lbs_crosses) || "Stringer’s choice tension",
    date: formatShopDate(order.picked_up_at || order.fulfilled_at || order.created_at),
    shop: clean(order.vendor_name),
    priceCents: Number(tier.price_cents) || 0,
    tierName: clean(tier.name),
  };
}

const tensionOf = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 40 && number <= 70 ? Math.round(number) : null;
};

/**
 * A new order's setup, rebuilt from a past item. `catalog` is the shop's current strings for
 * that service. `stocked` is false when the string it used isn't stocked any more: the player
 * then picks another string instead of going straight to checkout.
 */
export function reorderPlan({ item, tier, catalog = [] }) {
  const own = tier?.string_category == null && !tier?.string_composition;
  const preset = Boolean(tier?.string_composition);
  const mains = tensionOf(item?.tension_lbs_mains);
  const crosses = tensionOf(item?.tension_lbs_crosses);
  const base = {
    tierId: tier?.id ?? null,
    racketMakeModel: clean(item?.racket_make_model),
    adviceRequested: Boolean(item?.advice_requested) && mains === null,
    tensionMains: mains ?? (tier?.string_category?.includes("poly") ? 50 : 54),
    tensionCrosses: crosses ?? mains ?? (tier?.string_category?.includes("poly") ? 50 : 54),
    splitTension: mains !== null && crosses !== null && mains !== crosses,
    stringId: "",
    gauge: clean(item?.gauge),
    ownString: "",
    customString: "",
    stocked: true,
  };
  if (preset) return { ...base, gauge: "" };
  if (own) return { ...base, ownString: clean(item?.own_string_text), stocked: Boolean(clean(item?.own_string_text)) };
  if (!item?.string_id && clean(item?.custom_string_text)) {
    return { ...base, stringId: "other", customString: clean(item.custom_string_text) };
  }
  const row = (Array.isArray(catalog) ? catalog : []).find((string) => Number(string.id) === Number(item?.string_id));
  if (!row || row.in_stock === false) return { ...base, stringId: "", stocked: false };
  return { ...base, stringId: String(row.id) };
}

/**
 * Shops for "Stringers near you": within the player's radius when we know where they are,
 * nearest first; every shop when we don't (no distances to filter on).
 */
export function nearbyStringers(vendors, radiusMiles) {
  const rows = Array.isArray(vendors) ? vendors : [];
  const radius = Number(radiusMiles);
  const hasDistances = rows.some((vendor) => Number.isFinite(Number(vendor?.distance_miles)) && vendor?.distance_miles !== null);
  if (!hasDistances || !Number.isFinite(radius) || radius <= 0) return rows;
  return rows.filter((vendor) => vendor?.distance_miles !== null && Number(vendor.distance_miles) <= radius);
}

/**
 * A shop's tags, only from what we know about it: turnaround, strings in stock, whether it
 * restrings a string you bring, and whether it's open right now.
 */
export function stringerTags(vendor, { stringCount = null, takesOwnString = false, now = new Date() } = {}) {
  const tags = [];
  const days = Number(vendor?.turnaround_days);
  if (Number.isFinite(days) && days > 0) tags.push(`${days}-day turnaround`);
  if (Number(stringCount) > 0) tags.push(`${stringCount} string${Number(stringCount) === 1 ? "" : "s"} in stock`);
  if (takesOwnString) tags.push("Bring your own string");
  const open = vendorOpenStatus(vendor?.hours, now);
  if (open?.isOpen) tags.push("Open now");
  return tags;
}

/** "2.4 mi", or "" without a distance. */
export const distanceLabel = (vendor) => {
  const miles = Number(vendor?.distance_miles);
  return vendor?.distance_miles !== null && vendor?.distance_miles !== undefined && Number.isFinite(miles)
    ? `${miles.toFixed(1)} mi`
    : "";
};
