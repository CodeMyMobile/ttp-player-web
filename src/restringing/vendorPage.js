import { catalogGaugesForString } from "./playerFlow.js";

// Vendors have no timezone field yet; every shop on the platform is in Los Angeles.
export const VENDOR_TIME_ZONE = "America/Los_Angeles";

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const DAY_SHORT_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const RANGE_PATTERN = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/;

// "08:00-20:00" -> { openMinutes: 480, closeMinutes: 1200 }. Anything else (a missing day, null,
// "closed", a malformed range) is a closed day — the closed-day format is not defined by the API yet.
function parseRange(value) {
  const match = RANGE_PATTERN.exec(String(value ?? ""));
  if (!match) return null;
  const [openHour, openMinute, closeHour, closeMinute] = match.slice(1).map(Number);
  if (openHour > 24 || closeHour > 24 || openMinute > 59 || closeMinute > 59) return null;
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;
  if (closeMinutes <= openMinutes) return null;
  return { openMinutes, closeMinutes };
}

export function formatClock(minutes) {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute ? `${hour12}:${String(minute).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

/**
 * Normalize the vendor `hours` payload ({"mon":"08:00-20:00",…}) into Mon–Sun rows.
 * Returns null when there is nothing usable, so the caller can hide the section.
 */
export function parseVendorHours(hours) {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const days = DAY_KEYS.map((key) => {
    const range = parseRange(hours[key]);
    return {
      key,
      label: DAY_LABELS[key],
      closed: !range,
      openMinutes: range ? range.openMinutes : null,
      closeMinutes: range ? range.closeMinutes : null,
      text: range ? `${formatClock(range.openMinutes)} – ${formatClock(range.closeMinutes)}` : "Closed",
    };
  });
  return days.some((day) => !day.closed) ? days : null;
}

// Weekday and minutes-past-midnight on the shop's wall clock, whatever the viewer's timezone.
function shopClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    dayKey: read("weekday").toLowerCase().slice(0, 3),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

/**
 * Open/closed state for the "Open now · until 8 PM" tag and the highlighted row in the hours list.
 * Returns null when the vendor has no usable hours.
 */
export function vendorOpenStatus(hours, now = new Date(), timeZone = VENDOR_TIME_ZONE) {
  const days = parseVendorHours(hours);
  if (!days) return null;

  const { dayKey, minutes } = shopClock(now, timeZone);
  const todayIndex = DAY_KEYS.indexOf(dayKey);
  if (todayIndex < 0) return null;
  const today = days[todayIndex];

  if (!today.closed && minutes >= today.openMinutes && minutes < today.closeMinutes) {
    return { isOpen: true, todayKey: dayKey, label: `Open now · until ${formatClock(today.closeMinutes)}` };
  }
  if (!today.closed && minutes < today.openMinutes) {
    return { isOpen: false, todayKey: dayKey, label: `Closed · opens ${formatClock(today.openMinutes)}` };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = days[(todayIndex + offset) % 7];
    if (next.closed) continue;
    const when = offset === 1 ? "tomorrow" : DAY_SHORT_LABELS[next.key];
    return { isOpen: false, todayKey: dayKey, label: `Closed · opens ${when} ${formatClock(next.openMinutes)}` };
  }
  return { isOpen: false, todayKey: dayKey, label: "Closed" };
}

/**
 * One-line hours for running text: "Mon–Sat 8 AM – 8 PM, Sun 8 AM – 5 PM". Consecutive days with
 * the same hours are grouped; closed days are left out. Empty string when there are no hours.
 */
export function vendorHoursSummary(hours) {
  const days = parseVendorHours(hours);
  if (!days) return "";
  const groups = [];
  days.forEach((day, index) => {
    if (day.closed) return;
    const last = groups[groups.length - 1];
    if (last && last.text === day.text && last.endIndex === index - 1) {
      last.endIndex = index;
    } else {
      groups.push({ startIndex: index, endIndex: index, text: day.text });
    }
  });
  return groups
    .map(({ startIndex, endIndex, text }) => {
      const start = DAY_SHORT_LABELS[DAY_KEYS[startIndex]];
      const end = DAY_SHORT_LABELS[DAY_KEYS[endIndex]];
      return `${startIndex === endIndex ? start : `${start}–${end}`} ${text}`;
    })
    .join(", ");
}

// Vendors write collection details for the "ready for pickup" text, so some carry SMS-only
// lines. Strip the reply warning on the web page, where it makes no sense.
const SMS_ONLY_PHRASES = [/\bdo not reply to this message\b[.!]*/gi];

export function collectionDetailsForPage(text) {
  return SMS_ONLY_PHRASES
    .reduce((value, pattern) => value.replace(pattern, ""), String(text || ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Mirrors the admin recommendation config. Hardcoded until the API exposes it publicly.
const TENSION_BY_CATEGORY = {
  syn_gut: { defaultLbs: 54, minLbs: 52, maxLbs: 56 },
  std_multi: { defaultLbs: 54, minLbs: 52, maxLbs: 56 },
  prem_multi: { defaultLbs: 54, minLbs: 52, maxLbs: 56 },
  std_poly: { defaultLbs: 50, minLbs: 48, maxLbs: 52 },
  prem_poly: { defaultLbs: 50, minLbs: 48, maxLbs: 52 },
};

// Categories with no configured range (own string, hybrids, natural gut) get the wide range the
// design uses for "Restringing only"; it sits inside the 40–70 the checkout endpoint accepts.
const TENSION_FALLBACK = { defaultLbs: 52, minLbs: 40, maxLbs: 65 };

export function tensionConfigForCategory(category) {
  const config = TENSION_BY_CATEGORY[category];
  return config ? { ...config, isFallback: false } : { ...TENSION_FALLBACK, isFallback: true };
}

export function clampTension(value, category) {
  const { defaultLbs, minLbs, maxLbs } = tensionConfigForCategory(category);
  const tension = Number(value);
  if (!Number.isFinite(tension)) return defaultLbs;
  return Math.min(maxLbs, Math.max(minLbs, Math.round(tension)));
}

/**
 * Gauge chips for a chosen catalog string: shown only when it comes in more than one gauge,
 * defaulting to the first. A single gauge is picked automatically.
 */
export function gaugeChoiceForString(string) {
  const gauges = string ? catalogGaugesForString(string) : [];
  return {
    gauges,
    defaultGauge: gauges[0] || null,
    needsChoice: gauges.length > 1,
  };
}

// When the shop has no tier for the quiz's category, the nearest one: the same material a step
// down or up in price, then the closest material.
const CATEGORY_FALLBACKS = {
  prem_multi: ["std_multi", "syn_gut", "prem_poly", "std_poly"],
  std_multi: ["prem_multi", "syn_gut", "std_poly", "prem_poly"],
  prem_poly: ["std_poly", "prem_multi", "std_multi", "syn_gut"],
  std_poly: ["prem_poly", "std_multi", "syn_gut", "prem_multi"],
  syn_gut: ["std_multi", "std_poly", "prem_multi", "prem_poly"],
};

/** The tier to preselect for a quiz category: an exact match, else the nearest one offered. */
export function tierForRecommendedCategory(tiers, category) {
  const rows = Array.isArray(tiers) ? tiers : [];
  for (const candidate of [category, ...(CATEGORY_FALLBACKS[category] || [])]) {
    const tier = rows.find((item) => item?.string_category === candidate);
    if (tier) return tier;
  }
  return null;
}

export const STRING_CHOICE = {
  SHOP: "shop_choice",
  SPECIFIED: "specified",
  OWN: "player_supplied",
  // Page-only: string and tension are agreed with the stringer at drop-off. Sent to the API as
  // stringer's pick with advice_requested, which makes the shop record the final setup.
  AT_DROP_OFF: "at_drop_off",
};

const cleanText = (value) => String(value || "").trim();

/** What is still missing before Book can be tapped. Empty array = ready. */
export function orderSelectionGaps({ tier, stringChoice, stringId, gauge, ownStringText, racketMakeModel }) {
  const gaps = [];
  if (!tier) return ["service"];
  if (tier.string_category === null) {
    if (!cleanText(ownStringText)) gaps.push("string");
  } else if (stringChoice === STRING_CHOICE.SPECIFIED) {
    if (!stringId) gaps.push("string");
    else if (!cleanText(gauge)) gaps.push("gauge");
  } else if (stringChoice !== STRING_CHOICE.SHOP && stringChoice !== STRING_CHOICE.AT_DROP_OFF) {
    gaps.push("string");
  }
  if (!cleanText(racketMakeModel)) gaps.push("racket");
  return gaps;
}

// Printed on the shop's order and tag when the player leaves the tension to the stringer.
export const STRINGER_TENSION_NOTE = "Tension: stringer's choice";

/**
 * One checkout item for POST /player/restringing/checkout from the page's selections.
 * "Let my stringer choose" sends no tension plus a note. It deliberately does not set
 * `advice_requested`: the shop and the player's order list read that as "decide everything at
 * drop-off", which hides a string the player did choose.
 */
export function buildVendorPageCheckoutItem({
  tier,
  stringChoice,
  stringId = null,
  gauge = null,
  ownStringText = "",
  tensionLbs = null,
  stringerChoosesTension = false,
  racketMakeModel = "",
}) {
  const ownTier = tier.string_category === null;
  const atDropOff = !ownTier && stringChoice === STRING_CHOICE.AT_DROP_OFF;
  const selection = ownTier ? STRING_CHOICE.OWN : atDropOff ? STRING_CHOICE.SHOP : stringChoice;
  const specified = selection === STRING_CHOICE.SPECIFIED;
  const tension = atDropOff || stringerChoosesTension ? null : clampTension(tensionLbs, tier.string_category);

  if (atDropOff) {
    return {
      service_tier_id: Number(tier.id),
      string_selection: STRING_CHOICE.SHOP,
      string_id: null,
      custom_string_text: null,
      own_string_text: null,
      gauge: null,
      tension_lbs_mains: null,
      tension_lbs_crosses: null,
      advice_requested: true,
      racket_make_model: cleanText(racketMakeModel),
      notes: null,
    };
  }

  return {
    service_tier_id: Number(tier.id),
    string_selection: selection,
    string_id: specified ? Number(stringId) : null,
    custom_string_text: null,
    own_string_text: ownTier ? cleanText(ownStringText) : null,
    gauge: specified ? cleanText(gauge) || null : null,
    tension_lbs_mains: tension,
    tension_lbs_crosses: tension,
    advice_requested: false,
    racket_make_model: cleanText(racketMakeModel),
    notes: stringerChoosesTension ? STRINGER_TENSION_NOTE : null,
  };
}

// The order is saved before the auth drawer opens so it survives sign-in, including a Google
// OAuth round trip (sessionStorage is kept across same-tab redirects).
const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const draftKey = (vendorId) => `ttp.vendorPage.orderDraft.${vendorId}`;

const defaultStorage = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function saveOrderDraft(vendorId, draft, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage || !vendorId) return false;
  try {
    storage.setItem(draftKey(vendorId), JSON.stringify({ version: DRAFT_VERSION, savedAt: now, draft }));
    return true;
  } catch {
    return false;
  }
}

export function loadOrderDraft(vendorId, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage || !vendorId) return null;
  try {
    const stored = JSON.parse(storage.getItem(draftKey(vendorId)) || "null");
    if (!stored || stored.version !== DRAFT_VERSION || !stored.draft) return null;
    if (now - Number(stored.savedAt) > DRAFT_MAX_AGE_MS) return null;
    return stored.draft;
  } catch {
    return null;
  }
}

export function clearOrderDraft(vendorId, { storage = defaultStorage() } = {}) {
  if (!storage || !vendorId) return;
  try {
    storage.removeItem(draftKey(vendorId));
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

// ----- Prefill from a link (e.g. "Restring again" on My orders) -----
//
// /:vendorSlug?tier=5&string=2&gauge=16&tension=50&racket=Pure%20Aero
//   tension=stringer means "Let my stringer choose"; own=... is the player's own string.
// The page still checks everything against what the shop offers now: a string it no longer
// stocks falls back to stringer's pick, and the tension is clamped to the tier's range.

const positiveInt = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

export function parseVendorPagePrefill(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const tierId = positiveInt(params.get("tier"));
  if (!tierId) return null;
  const stringId = positiveInt(params.get("string"));
  const tension = cleanText(params.get("tension"));
  const tensionLbs = Number(tension);
  return {
    tierId,
    stringChoice: stringId ? STRING_CHOICE.SPECIFIED : STRING_CHOICE.SHOP,
    stringId,
    gauge: stringId ? cleanText(params.get("gauge")) || null : null,
    ownStringText: cleanText(params.get("own")),
    tensionLbs: Number.isFinite(tensionLbs) && tensionLbs > 0 ? tensionLbs : null,
    stringerChoosesTension: tension.toLowerCase() === "stringer",
    racketMakeModel: cleanText(params.get("racket")).slice(0, 255),
  };
}

const tensionNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** Query string that reopens an order item's setup on the vendor page; "" when it can't. */
export function vendorPagePrefillSearch(item) {
  const tierId = positiveInt(item?.service_tier_id);
  if (!tierId || item?.item_type === "custom") return "";
  const params = new URLSearchParams();
  params.set("tier", String(tierId));
  const own = cleanText(item.own_string_text);
  const stringId = positiveInt(item.string_id);
  if (own) {
    params.set("own", own);
  } else if (stringId) {
    params.set("string", String(stringId));
    if (cleanText(item.gauge)) params.set("gauge", cleanText(item.gauge));
  }
  const mains = tensionNumber(item.tension_lbs_mains);
  if (mains) params.set("tension", String(mains));
  else if (!item.advice_requested) params.set("tension", "stringer");
  if (cleanText(item.racket_make_model)) params.set("racket", cleanText(item.racket_make_model));
  return `?${params.toString()}`;
}
