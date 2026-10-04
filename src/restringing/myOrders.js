// Pure helpers for the My orders screen (/restring?screen=orders).
import { DAY_KEYS, VENDOR_TIME_ZONE, parseVendorHours, vendorOpenStatus, vendorPagePrefillSearch } from "./vendorPage.js";
import { vendorSlug } from "./vendorProfileRoutes.js";

const clean = (value) => String(value || "").trim();

export const ACTIVE_STATUSES = ["pending", "dropped_off", "in_progress", "ready_for_pickup"];
export const PAST_STATUSES = ["picked_up", "fulfilled", "cancelled"];
const COMPLETED_STATUSES = ["picked_up", "fulfilled"];

const statusOf = (order) => clean(order?.fulfillment_status).toLowerCase();

export const isActiveOrder = (order) => ACTIVE_STATUSES.includes(statusOf(order));
export const isPastOrder = (order) => PAST_STATUSES.includes(statusOf(order));
export const isCancelledOrder = (order) => statusOf(order) === "cancelled";

export function splitOrders(orders) {
  const rows = Array.isArray(orders) ? orders : [];
  return {
    active: rows.filter(isActiveOrder),
    past: rows.filter(isPastOrder),
  };
}

/** The one status chip per order. */
export function orderStatusChip(order) {
  switch (statusOf(order)) {
    case "pending":
      return { label: "Drop off racket", tone: "amber" };
    case "dropped_off":
    case "in_progress":
      return { label: "Stringing", tone: "purple" };
    case "ready_for_pickup":
      return { label: "Ready for pickup", tone: "green" };
    case "picked_up":
    case "fulfilled":
      return { label: "Picked up", tone: "grey" };
    case "cancelled":
      return { label: "Cancelled", tone: "red" };
    default:
      return { label: "Processing", tone: "grey" };
  }
}

/** Payment, shown next to the price only. */
export function orderPaymentNote(order) {
  const payment = clean(order?.payment_status).toLowerCase();
  if (payment === "payment_failed") return { label: "Payment failed", tone: "red" };
  if (isCancelledOrder(order)) return payment === "refunded" ? { label: "Refunded", tone: "grey" } : null;
  if (payment === "paid") return { label: "Paid", tone: "grey" };
  if (payment === "refunded") return { label: "Refunded", tone: "grey" };
  if (payment === "unpaid" && isActiveOrder(order)) return { label: "Pay at drop-off", tone: "amber" };
  return null;
}

// ----- Dates, on the shop's calendar -----

const dateParts = (value, timeZone = VENDOR_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
};

// A calendar day as UTC noon, so formatting and weekday maths never cross a date line.
const calendarDay = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day, 12));

const dayKeyOf = (day) => DAY_KEYS[(day.getUTCDay() + 6) % 7];

const formatDay = (day) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(day);

/** "Fri, Oct 3" for a timestamp, on the shop's calendar. */
export function formatShopDate(value) {
  const parts = value ? dateParts(value) : null;
  return parts ? formatDay(calendarDay(parts)) : "";
}

/**
 * Estimated ready date: drop-off day + turnaround days, counting only days the shop is open
 * (when its hours are known). Null before drop-off or without a turnaround.
 */
export function estimatedReadyDate(order) {
  const turnaround = Number(order?.vendor_turnaround_days);
  const dropped = order?.dropped_off_at ? dateParts(order.dropped_off_at) : null;
  if (!dropped || !Number.isFinite(turnaround) || turnaround < 0) return null;
  const hours = parseVendorHours(order.vendor_hours);
  const openDays = hours ? new Set(hours.filter((day) => !day.closed).map((day) => day.key)) : null;
  const day = calendarDay(dropped);
  let remaining = Math.round(turnaround);
  let guard = 0;
  while (remaining > 0 && guard < 60) {
    day.setUTCDate(day.getUTCDate() + 1);
    guard += 1;
    if (!openDays || openDays.has(dayKeyOf(day))) remaining -= 1;
  }
  return formatDay(day);
}

const dayCount = (days) => {
  const count = Number(days);
  return Number.isFinite(count) && count > 0 ? `${count} day${count === 1 ? "" : "s"}` : "";
};

/** The "when will it be ready" line on an active order card. */
export function readyLine(order, now = new Date()) {
  const status = statusOf(order);
  if (status === "pending") {
    const days = dayCount(order.vendor_turnaround_days);
    const today = parseVendorHours(order.vendor_hours);
    const open = vendorOpenStatus(order.vendor_hours, now);
    const todayRow = today && open ? today.find((day) => day.key === open.todayKey) : null;
    const hoursText = todayRow ? ` · Today ${todayRow.closed ? "closed" : todayRow.text}` : "";
    return days ? `Ready ${days} after drop-off${hoursText}` : `Drop off your racket to start${hoursText}`;
  }
  if (status === "ready_for_pickup") {
    return order.ready_at ? `Ready since ${formatShopDate(order.ready_at)}` : "Ready for pickup";
  }
  const estimate = estimatedReadyDate(order);
  return estimate ? `Estimated ready ${estimate}` : "";
}

// ----- Progress: Dropped off → Stringing → Ready → Picked up -----

const STEP_RANK = { pending: 0, dropped_off: 1, in_progress: 2, ready_for_pickup: 3, picked_up: 4, fulfilled: 4 };

export function orderProgressSteps(order) {
  const status = statusOf(order);
  const rank = STEP_RANK[status] ?? 0;
  // in_progress is optional and untimed: Stringing counts as done once the order is ready.
  const done = [
    rank >= 1 || Boolean(order?.dropped_off_at),
    rank >= 3 || Boolean(order?.ready_at),
    rank >= 3 || Boolean(order?.ready_at),
    rank >= 4 || Boolean(order?.picked_up_at),
  ];
  const labels = ["Dropped off", "Stringing", "Ready", "Picked up"];
  const dates = [
    order?.dropped_off_at ? formatShopDate(order.dropped_off_at) : "",
    "",
    order?.ready_at ? formatShopDate(order.ready_at) : "",
    order?.picked_up_at ? formatShopDate(order.picked_up_at) : "",
  ];
  const current = done.indexOf(false);
  return labels.map((label, index) => ({
    label,
    state: done[index] ? "done" : index === current ? "current" : "todo",
    date: dates[index],
  }));
}

// ----- Items -----

const tensionValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

// "52.0" -> "52", "52.5" -> "52.5".
const lbs = (value) => String(Number(value.toFixed(1)));

/** "52 lbs", "52/50 lbs", or "" when no tension is recorded. */
export function formatTension(mains, crosses) {
  const main = tensionValue(mains);
  const cross = tensionValue(crosses);
  if (main === null && cross === null) return "";
  if (main === null || cross === null || main === cross) return `${lbs(main ?? cross)} lbs`;
  return `${lbs(main)}/${lbs(cross)} lbs`;
}

export function itemStringName(item) {
  const catalog = [clean(item?.string_brand), clean(item?.string_name)].filter(Boolean).join(" ");
  if (catalog) return catalog;
  if (clean(item?.own_string_text)) return `${clean(item.own_string_text)} (your string)`;
  if (clean(item?.custom_string_text)) return clean(item.custom_string_text);
  return "Stringer’s choice";
}

/** One line per item: racket as the title, then string · gauge · tension. */
export function orderItemLine(item) {
  if (item?.item_type === "custom") {
    const qty = Number(item.item_qty) || 1;
    return { title: `${clean(item.label) || "Item"}${qty > 1 ? ` × ${qty}` : ""}`, detail: "" };
  }
  const title = clean(item?.racket_make_model) || "Racket";
  const tension = formatTension(item?.tension_lbs_mains, item?.tension_lbs_crosses);
  if (item?.advice_requested && !tension && !clean(item?.gauge) && !clean(item?.custom_string_text)) {
    return { title, detail: "Setup decided at drop-off" };
  }
  const parts = [itemStringName(item), clean(item?.gauge), tension || "Stringer’s choice tension"];
  return { title, detail: parts.filter(Boolean).join(" · ") };
}

// ----- Money, links, shop -----

export const formatOrderTotal = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export function directionsUrl(address) {
  const text = clean(address);
  return text ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}` : "";
}

export const displayAddress = (address) => clean(address).replace(/,\s*USA$/i, "");

const restringItem = (order) =>
  (Array.isArray(order?.items) ? order.items : []).find((item) => item?.item_type !== "custom" && item?.service_tier_id) || null;

/** Link to the shop's page with this order's setup filled in; "" when it can't be rebuilt. */
export function restringAgainHref(order) {
  const slug = vendorSlug(order?.vendor_name);
  const item = restringItem(order);
  const search = item ? vendorPagePrefillSearch(item) : "";
  return slug && search ? `/${slug}${search}` : "";
}

const timeOf = (order) => new Date(order?.picked_up_at || order?.fulfilled_at || order?.created_at || 0).getTime() || 0;

/** "Your usual setup": the latest picked-up order with a restring on it. */
export function usualSetup(orders) {
  const completed = (Array.isArray(orders) ? orders : [])
    .filter((order) => COMPLETED_STATUSES.includes(statusOf(order)) && restringItem(order))
    .sort((left, right) => timeOf(right) - timeOf(left));
  const order = completed[0];
  if (!order) return null;
  const item = restringItem(order);
  return {
    order,
    item,
    line: orderItemLine(item),
    href: restringAgainHref(order),
  };
}

/** "Updated just now" / "Updated 5 min ago" / "Updated 2 h ago". */
export function updatedLabel(updatedAt, now = Date.now()) {
  if (!updatedAt) return "";
  const minutes = Math.floor((now - updatedAt) / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${Math.floor(minutes / 60)} h ago`;
}
