export const GAUGES = ["15L", "16", "16L", "17", "17L", "18"];

export const lbsToKg = (lbs) => (Number(lbs) * 0.45359237).toFixed(1);

const titleizeSlug = (value) =>
  String(value || "")
    .replace(/[_/-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const categoryLabel = (category) => ({
  syn_gut: "Synthetic Gut",
  std_multi: "Standard Multifilament",
  prem_multi: "Premium Multifilament",
  std_poly: "Standard Polyester",
  prem_poly: "Premium Polyester",
  // The 3 new categories (poly/multi hybrid, gut/poly hybrid, natural gut) render
  // via the titleized-slug fallback until Sahil confirms their exact enum keys.
}[category] || (category ? titleizeSlug(category) : "String"));

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

/* ---------------- string-first catalog helpers ---------------- */

// Material bucket derived from the category slug. The catalog's `material` field
// is free text / may be absent, so we derive from the category enum (the brief's
// "derive the material filter from the category slug"). Backend dependency: this
// assumes the category slug contains the material words.
export function materialFromCategory(category) {
  const value = String(category || "").toLowerCase();
  if (!value) return "own";
  const poly = value.includes("poly");
  const multi = value.includes("multi");
  const gut = value.includes("gut");
  const syn = value.includes("syn");
  const nat = value.includes("nat");
  if (value.includes("hybrid") || (poly && (multi || gut))) return "hybrid";
  if (syn) return "syn gut";
  if (nat || (gut && !poly && !syn)) return "nat gut";
  if (poly) return "poly";
  if (multi) return "multi";
  return "other";
}

export const isHybridCategory = (category) => materialFromCategory(category) === "hybrid";

// Flatten per-tier vendor catalogs into one list, tagging each string with the
// category / price / material of the tier it came from. Assembled once and cached;
// keystroke filtering runs over the result and never re-fetches.
export function mergeTierCatalogs(tierCatalogs = []) {
  const seen = new Set();
  const merged = [];
  tierCatalogs.forEach(({ tier, catalog = [] }) => {
    (catalog || []).forEach((row) => {
      if (!row) return;
      const category = row.string_category ?? tier?.string_category ?? null;
      const key = row.id != null
        ? `id:${row.id}`
        : `nm:${cleanText(row.brand).toLowerCase()}|${cleanText(row.name).toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        ...row,
        string_category: category,
        tier_id: row.tier_id ?? tier?.id ?? null,
        price_cents: row.price_cents ?? tier?.price_cents ?? null,
        material: row.material || materialFromCategory(category),
      });
    });
  });
  return merged;
}

export const deriveTier = (category, tiers = []) =>
  tiers.find((tier) => tier && tier.string_category === category) || null;

// Brands available within the active material — keeps the two filters from
// intersecting to nothing on a tap (brief: brand list scoped to active material).
export function brandsForMaterial(catalog = [], material = "all") {
  const pool = material === "all" ? catalog : catalog.filter((row) => row.material === material);
  return [...new Set(pool.map((row) => cleanText(row.brand)).filter(Boolean))].sort();
}

export function filterCatalog(catalog = [], { query = "", material = "all", brand = "all" } = {}) {
  const needle = String(query).trim().toLowerCase();
  return catalog.filter((row) => {
    if (material !== "all" && row.material !== material) return false;
    if (brand !== "all" && cleanText(row.brand) !== brand) return false;
    if (needle && !`${cleanText(row.brand)} ${cleanText(row.name)}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}

// Split text into parts for highlighting the matched substring (case-insensitive,
// first occurrence). Returns [{ text, match }]; the JSX wraps match parts in <mark>.
export function highlightMatch(text, query) {
  const source = String(text ?? "");
  const needle = String(query ?? "").trim();
  if (!needle) return [{ text: source, match: false }];
  const index = source.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return [{ text: source, match: false }];
  return [
    { text: source.slice(0, index), match: false },
    { text: source.slice(index, index + needle.length), match: true },
    { text: source.slice(index + needle.length), match: false },
  ].filter((part) => part.text.length > 0);
}

// Exact-match a past order item back to a current catalog entry (string_id first,
// then exact brand+name). No fuzzy matching by design — a wrong prefill is worse
// than none. Returns the catalog row, or null (null → route to search prefilled).
export function resolveReorderString(orderItem, catalog = []) {
  if (!orderItem) return null;
  if (orderItem.string_id != null && orderItem.string_id !== "") {
    const byId = catalog.find((row) => Number(row.id) === Number(orderItem.string_id));
    if (byId) return byId;
  }
  const brand = cleanText(orderItem.string_brand).toLowerCase();
  const name = cleanText(orderItem.string_name).toLowerCase();
  if (!name) return null;
  return catalog.find((row) =>
    cleanText(row.brand).toLowerCase() === brand &&
    cleanText(row.name).toLowerCase() === name,
  ) || null;
}

// Run a catalog-assembly and ALWAYS resolve to { catalog, error } — never reject.
// This is the guarantee the loading flag relies on: whatever `assemble` does
// (returns rows, returns nothing, or throws), the caller's finally always runs.
export async function loadCatalog(assemble) {
  try {
    const rows = await assemble();
    return { catalog: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    return { catalog: [], error: (err && err.message) || "Could not load strings." };
  }
}
