export const GAUGES = ["15L", "16", "16L", "17", "17L", "18"];

export const vendorImageSrc = (vendor) => String(vendor?.image_url || "").trim();

const normalizeGaugeList = (values) => {
  const rows = Array.isArray(values) ? values : [];
  return [...new Set(rows.map((value) => String(value || "").trim()).filter(Boolean))];
};

export function catalogGaugesForString(string) {
  if (!string) return GAUGES;
  const realGauges = normalizeGaugeList(string.gauges);
  const stockedGauges = normalizeGaugeList(string.gauges_stocked);
  if (stockedGauges.length && realGauges.length) {
    return stockedGauges.filter((gauge) => realGauges.includes(gauge));
  }
  return stockedGauges.length ? stockedGauges : realGauges;
}

export function defaultGaugeForString(string) {
  const gauges = catalogGaugesForString(string);
  return gauges.includes("16") ? "16" : gauges[0] || "16";
}

export const lbsToKg = (lbs) => (Number(lbs) * 0.45359237).toFixed(1);

export const categoryLabel = (category) => ({
  syn_gut: "Synthetic Gut",
  std_multi: "Standard Multifilament",
  prem_multi: "Premium Multifilament",
  std_poly: "Standard Polyester",
  prem_poly: "Premium Polyester",
  // The hybrid and natural gut services' string categories (ttp-api admin_restringing.js).
  poly_multi: "Poly / Multi Hybrid",
  gut_poly: "Natural Gut Hybrid",
  nat_gut: "Natural Gut",
}[category] || "String");

const PRESET_COMPOSITIONS = new Set([
  "poly_multi_hybrid",
  "natural_gut_hybrid",
  "natural_gut",
]);

export const isPresetCompositionTier = (tier) => PRESET_COMPOSITIONS.has(tier?.string_composition);

export const serviceCompositionLabel = (composition) => ({
  poly_multi_hybrid: "Polyester + Multifilament hybrid",
  natural_gut_hybrid: "Natural gut hybrid",
  natural_gut: "Natural gut",
}[composition] || "Included strings");

const titleizeStatus = (value) => cleanText(value)
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const orderStatusLabel = (status) => ({
  pending: "Pending drop-off",
  dropped_off: "Dropped off",
  in_progress: "Stringing",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  fulfilled: "Picked up",
  cancelled: "Cancelled",
}[cleanText(status).toLowerCase()] || titleizeStatus(status) || "Unknown");

export const paymentStatusLabel = (status) => ({
  unpaid: "Awaiting payment",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
}[cleanText(status).toLowerCase()] || titleizeStatus(status) || "Unknown");

// The 4-question string quiz. Answers feed recommendStringCategory; shared by the restring flow
// and the public vendor page.
export const WIZARD_QUESTIONS = [
  { key: "arm", label: "Arm/elbow/shoulder discomfort?", options: ["Yes", "Sometimes", "No"] },
  { key: "breaks", label: "How often do you break strings?", options: ["Rarely", "Every couple of months", "Monthly+"] },
  { key: "priority", label: "What matters most?", options: ["Spin & control", "Power & comfort", "Reliable & affordable"] },
  { key: "budget", label: "Premium or standard?", options: ["Best performance", "Good value"] },
];

export function recommendStringCategory(answers = {}) {
  const premium = answers.budget === "Best performance" || answers.premiumPreference === "premium";
  const arm = answers.arm || answers.armDiscomfort;
  const breaks = answers.breaks || answers.breakFrequency;
  const priority = answers.priority;
  let category;
  let rationale;

  if (arm === "Yes" || arm === "yes") {
    category = premium ? "prem_multi" : "std_multi";
    rationale = "Multifilament is the arm-friendly choice: soft, powerful, and never polyester for current discomfort.";
  } else if (priority === "Reliable & affordable" || priority === "reliable_affordable") {
    category = "syn_gut";
    rationale = "Synthetic gut gives dependable all-round performance at the best price.";
  } else if (
    breaks === "Monthly+" ||
    breaks === "Monthly or more" ||
    breaks === "monthly_or_more" ||
    priority === "Spin & control" ||
    priority === "spin_control"
  ) {
    category = premium ? "prem_poly" : "std_poly";
    rationale = "Polyester adds spin, control, and durability for heavy string wear.";
  } else {
    category = premium ? "prem_multi" : "std_multi";
    rationale = "Multifilament is the power-and-comfort pick with a lively string bed.";
  }

  let tensionLbs = category.includes("poly") ? 50 : 54;
  if (["Yes", "Sometimes", "yes", "sometimes"].includes(arm)) tensionLbs -= 2;

  return {
    category,
    categoryLabel: categoryLabel(category),
    rationale,
    tensionLbs,
  };
}

const cleanText = (value) => String(value || "").trim();
const nullableText = (value) => cleanText(value) || null;
const boundedTension = (value) => {
  const tension = Number(value);
  if (!Number.isFinite(tension) || tension < 40 || tension > 70) return null;
  return tension;
};

function buildOneItem({
  serviceTierId,
  selectedStringId = null,
  customStringText = null,
  ownStringText = null,
  gauge = null,
  tensionMains = null,
  tensionCrosses = null,
  adviceRequested = false,
  racketMakeModel = "",
  notes = null,
  crossesStringId = null,
  crossesGauge = null,
}) {
  const advice = Boolean(adviceRequested);
  const stringId = selectedStringId === null || selectedStringId === "" ? null : Number(selectedStringId);
  const crossesId = crossesStringId === null || crossesStringId === "" ? null : Number(crossesStringId);
  // A custom hybrid: the string above is the mains, this the crosses.
  const hybrid = Number.isInteger(stringId) && stringId > 0 && Number.isInteger(crossesId) && crossesId > 0;
  const mains = boundedTension(tensionMains);
  const crosses = boundedTension(tensionCrosses ?? tensionMains);

  return {
    service_tier_id: Number(serviceTierId),
    string_id: Number.isInteger(stringId) && stringId > 0 ? stringId : null,
    custom_string_text: nullableText(customStringText),
    own_string_text: nullableText(ownStringText),
    gauge: advice ? null : nullableText(gauge),
    tension_lbs_mains: advice ? null : mains,
    tension_lbs_crosses: advice ? null : crosses,
    advice_requested: advice,
    racket_make_model: cleanText(racketMakeModel),
    notes: nullableText(notes),
    ...(hybrid ? { crosses_string_id: crossesId, crosses_gauge: advice ? null : nullableText(crossesGauge) } : {}),
  };
}

// The most rackets one order can hold; the API enforces the same limit.
export const MAX_RACKETS = 12;

export function buildCheckoutItems({
  serviceTierId,
  selectedStringId = null,
  customStringText = null,
  ownStringText = null,
  gauge = "16",
  tensionMains = 54,
  tensionCrosses = null,
  adviceRequested = false,
  racketMakeModel = "",
  orderNotes = null,
  quantity = 1,
  setupMode = "same",
  perRacketItems = [],
  crossesStringId = null,
  crossesGauge = null,
}) {
  const count = Math.max(1, Math.min(MAX_RACKETS, Number(quantity) || 1));
  if (setupMode === "different" && !adviceRequested) {
    return perRacketItems.slice(0, count).map((item) => buildOneItem({
      serviceTierId,
      selectedStringId: item.stringId ?? selectedStringId,
      customStringText: item.customStringText ?? customStringText,
      ownStringText: item.ownStringText ?? ownStringText,
      gauge: item.gauge ?? gauge,
      tensionMains: item.tensionMains ?? tensionMains,
      tensionCrosses: item.tensionCrosses ?? item.tensionMains ?? tensionCrosses ?? tensionMains,
      adviceRequested: false,
      racketMakeModel: item.racketMakeModel,
      notes: item.note,
      crossesStringId,
      crossesGauge,
    }));
  }

  return Array.from({ length: count }, () => buildOneItem({
    serviceTierId,
    selectedStringId,
    customStringText,
    ownStringText,
    gauge,
    tensionMains,
    tensionCrosses: tensionCrosses ?? tensionMains,
    adviceRequested,
    racketMakeModel,
    notes: orderNotes,
    crossesStringId,
    crossesGauge,
  }));
}

/** The add-ons chosen at checkout ({ offerId: quantity }) as order items. Zeros are left out. */
export function addOnCheckoutItems(quantities = {}) {
  return Object.entries(quantities || {})
    .map(([offerId, qty]) => ({ offerId: Number(offerId), qty: Number(qty) }))
    .filter(({ offerId, qty }) => Number.isInteger(offerId) && offerId > 0 && Number.isInteger(qty) && qty > 0)
    .map(({ offerId, qty }) => ({ item_type: "add_on", add_on_offer_id: offerId, item_qty: qty }));
}

const CHECKOUT_ERRORS = {
  discount_code_invalid: "That code isn't valid at this shop.",
  discount_code_attempts_exceeded: "Too many tries. Try again in an hour, or ask the shop.",
  add_on_offer_not_found: "That item is no longer offered. It's been taken off your order.",
  too_many_rackets: `One order can hold up to ${MAX_RACKETS} rackets.`,
};

/** What to tell the player when pricing or checkout fails with one of the API's codes. */
export function checkoutErrorMessage(error, fallback = "Checkout failed.") {
  const detail = error?.data?.detail;
  return (typeof detail === "string" && CHECKOUT_ERRORS[detail]) || error?.message || fallback;
}

export const formatMoneyCents = (cents) =>
  `$${(Number(cents || 0) / 100).toFixed(2)}`;

const centsOrNull = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

/**
 * One restring's price and its taxable part, as the API prices it. A string the shop has
 * priced costs labor plus the string (the catalog's restring_price_cents), taxed on the
 * string only; a custom hybrid (`crosses`) costs labor plus half of each string; any
 * other restring costs its service's price, taxed on its taxable_cents.
 */
export function restringUnitPrice(tier, string = null, crosses = null) {
  const restring = centsOrNull(string?.restring_price_cents);
  const stringPrice = centsOrNull(string?.string_price_cents);
  // A custom hybrid: labor plus half of each string, the halves rounded half-up once.
  const crossesPrice = centsOrNull(crosses?.string_price_cents);
  if (tier?.string_category && crosses && restring !== null && stringPrice !== null && crossesPrice !== null) {
    const labor = restring - stringPrice;
    const strings = Math.floor((stringPrice + crossesPrice) / 2 + 0.5);
    return { unitCents: labor + strings, taxableCents: strings };
  }
  if (tier?.string_category && restring !== null && stringPrice !== null) {
    return { unitCents: restring, taxableCents: stringPrice };
  }
  return {
    unitCents: Number(tier?.price_cents) || 0,
    taxableCents: Math.max(0, Number(tier?.taxable_cents) || 0),
  };
}

/** The lowest price among a category's strings, and whether they differ (a "from" price). */
export function categoryPrice(tier, strings = []) {
  const prices = (strings.length ? strings : [null]).map((string) => restringUnitPrice(tier, string).unitCents);
  const lowest = Math.min(...prices);
  return { priceCents: lowest, varies: prices.some((price) => price !== lowest) };
}

/**
 * The rackets' cost split into stringing labor and string, for checkout's line items:
 * { rackets, laborCents, stringCents }, before any discount. From the API's quote when its
 * lines carry taxable_unit_cents (the string part), otherwise from `localPrices`, the
 * restringUnitPrice of each racket worked out here.
 */
export function restringCostSplit({ quoteItems = null, localPrices = [] } = {}) {
  const restrings = Array.isArray(quoteItems)
    ? quoteItems.filter((item) => !item.add_on_offer_id && item.item_type !== "custom" && item.item_type !== "add_on")
    : [];
  const empty = { rackets: 0, laborCents: 0, stringCents: 0 };
  if (restrings.length && restrings.every((item) => item.taxable_unit_cents !== undefined && item.taxable_unit_cents !== null)) {
    return restrings.reduce((sum, item) => {
      const qty = Number(item.item_qty) || 1;
      const unit = Number(item.unit_price_cents) || 0;
      const string = Math.min(unit, Math.max(0, Number(item.taxable_unit_cents) || 0));
      return { rackets: sum.rackets + qty, laborCents: sum.laborCents + (unit - string) * qty, stringCents: sum.stringCents + string * qty };
    }, empty);
  }
  return localPrices.reduce((sum, price) => ({
    rackets: sum.rackets + 1,
    laborCents: sum.laborCents + price.unitCents - price.taxableCents,
    stringCents: sum.stringCents + price.taxableCents,
  }), empty);
}

// Sales tax on a restring, so the player sees what their card will be charged
// before the order exists. The API is what prices the order; this mirrors it.
// Labor is not taxed, and a vendor has a tax_rate only when the shop charges
// sales tax.
export function restringTaxCents({ tier, quantity = 1, vendor, string = null }) {
  const count = Math.max(1, Number(quantity) || 1);
  const taxable = restringUnitPrice(tier, string).taxableCents * count;
  return Math.round(taxable * (Number(vendor?.tax_rate) || 0));
}

export function normalizePaymentMethods(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.payment_methods)
      ? payload.payment_methods
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
  const defaultId = payload?.default_payment_method_id || payload?.default_payment_method || null;

  return rows
    .filter((method) => method && method.id)
    .map((method) => {
      const card = method.card || {};
      return {
        id: String(method.id),
        brand: cleanText(card.brand || method.brand || "card"),
        last4: cleanText(card.last4 || method.last4 || ""),
        expMonth: card.exp_month || method.exp_month || null,
        expYear: card.exp_year || method.exp_year || null,
        isDefault: Boolean(method.is_default || method.default || method.default_for_currency || method.id === defaultId),
      };
    })
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
}
