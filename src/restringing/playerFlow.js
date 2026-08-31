export const GAUGES = ["15L", "16", "16L", "17", "17L", "18"];

export const vendorImageSrc = (vendor) => String(vendor?.image_url || "").trim();

export const requiresVendorLogin = (isAuthenticated) => !isAuthenticated;

export const createSelection = ({ mode = "supplied", stringId = null, family = null, requestedText = "", ownStringText = "" } = {}) => ({
  mode,
  stringId: stringId || null,
  family: family || null,
  requestedText: String(requestedText || ""),
  ownStringText: String(ownStringText || ""),
});

export const nextScreenForVendor = (selection) => selection?.mode === "own" ? "rackets" : "setup";

export const STRING_FIRST_QUESTIONS = [
  { key: "arm", label: "Any arm or elbow trouble?", options: [["No problems", "none"], ["Occasional soreness", "soreness"], ["Recovering from an injury", "injury"]] },
  { key: "game", label: "How would you describe your game?", options: [["Still learning", "learning"], ["Solid rally player", "rally"], ["Competitive / league", "competitive"]] },
  { key: "break_frequency", label: "How often do you break strings?", options: [["Every few weeks", "weeks"], ["Every few months", "months"], ["Rarely or never", "rarely"]] },
  { key: "preference", label: "What do you most want from a restring?", options: [["Spin and control", "spin_control"], ["Comfort and power", "comfort_power"], ["Feel and touch", "feel_touch"], ["Maximum durability", "durability"]] },
];

// The recommendation screen must never wait on network availability. The API
// may enrich this later, but these four answers are sufficient for a safe
// starting family and tension.
export function wizardRecommendationFromAnswers(answers = {}) {
  const armSensitive = ["soreness", "injury"].includes(answers.arm);
  const preference = answers.preference;
  const category = armSensitive
    ? "std_multi"
    : preference === "spin_control" || preference === "durability"
      ? "std_poly"
      : preference === "feel_touch"
        ? "prem_multi"
        : "std_multi";
  return {
    category,
    categoryLabel: categoryLabel(category),
    tensionLbs: armSensitive ? 52 : category.includes("poly") ? 50 : 54,
  };
}

export function normaliseLastOrderPrefill(lastOrder) {
  const item = lastOrder?.item || {};
  return { vendorId: lastOrder?.vendor?.id || null, serviceTierId: item.service_tier_id || null, stringId: item.string_id || null, gauge: item.gauge || "16", tension: Number(item.tension_lbs_mains) || 54, crosses: Number(item.tension_lbs_crosses) || Number(item.tension_lbs_mains) || 54, racketMakeModel: item.racket_make_model || "", notes: item.notes || "" };
}

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
}) {
  const advice = Boolean(adviceRequested);
  const stringId = selectedStringId === null || selectedStringId === "" ? null : Number(selectedStringId);
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
  };
}

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
}) {
  const count = Math.max(1, Math.min(4, Number(quantity) || 1));
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
  }));
}

export const formatMoneyCents = (cents) =>
  `$${(Number(cents || 0) / 100).toFixed(2)}`;

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
