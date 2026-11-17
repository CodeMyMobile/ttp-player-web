// Pure helpers for the My orders screen (/restring?screen=orders).
import { DAY_KEYS, VENDOR_TIME_ZONE, parseVendorHours, vendorOpenStatus, vendorPagePrefillSearch } from "./vendorPage.js";
import { vendorSlug } from "./vendorProfileRoutes.js";
import { payLinkCostLines } from "../api/restringingPayLinks";

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

/** A new racket the player's coach ordered for them: nothing to drop off. */
export const isRacketSaleOrder = (order) =>
  (Array.isArray(order?.items) ? order.items : []).some((item) => item?.item_type === "racket");

/** The one status chip per order. */
export function orderStatusChip(order) {
  switch (statusOf(order)) {
    case "pending":
      return isRacketSaleOrder(order) ? { label: "Being prepared", tone: "purple" } : { label: "Drop off racket", tone: "amber" };
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

/** Payment, beside the price, for exceptions only: a normal paid order shows nothing. */
export function orderPaymentNote(order) {
  const payment = clean(order?.payment_status).toLowerCase();
  if (payment === "payment_failed") return { label: "Payment failed", tone: "red" };
  if (payment === "refunded") return { label: "Refunded", tone: "grey" };
  if (isCancelledOrder(order)) return null;
  if (payment === "paid") return clean(order?.payment_method).toLowerCase() === "comp" ? { label: "Comp", tone: "grey" } : null;
  if (payment === "unpaid" && isActiveOrder(order)) {
    return { label: isRacketSaleOrder(order) ? "Pay before pickup" : "Pay at drop-off", tone: "amber" };
  }
  return null;
}

/** True when the player's orders come from more than one shop, so rows need the shop's name. */
export function spansVendors(orders) {
  const shops = new Set((Array.isArray(orders) ? orders : []).map((order) => order?.vendor_id ?? clean(order?.vendor_name)));
  return shops.size > 1;
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
  if (status === "pending" && isRacketSaleOrder(order)) return "The shop is getting it ready";
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
  // A new racket is ordered, not dropped off.
  if (isRacketSaleOrder(order)) {
    const saleDone = [true, rank >= 3 || Boolean(order?.ready_at), rank >= 4 || Boolean(order?.picked_up_at)];
    const saleDates = [
      order?.created_at ? formatShopDate(order.created_at) : "",
      order?.ready_at ? formatShopDate(order.ready_at) : "",
      order?.picked_up_at ? formatShopDate(order.picked_up_at) : "",
    ];
    const saleCurrent = saleDone.indexOf(false);
    return ["Ordered", "Ready", "Picked up"].map((label, index) => ({
      label,
      state: saleDone[index] ? "done" : index === saleCurrent ? "current" : "todo",
      date: saleDates[index],
    }));
  }
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
  const crosses = [clean(item?.crosses_string_brand), clean(item?.crosses_string_name)].filter(Boolean).join(" ");
  if (catalog && crosses) return `${catalog} mains / ${crosses} crosses`;
  if (catalog) return catalog;
  if (clean(item?.own_string_text)) return `Own string: ${clean(item.own_string_text)}`;
  if (clean(item?.custom_string_text)) return clean(item.custom_string_text);
  return "Stringer’s choice";
}

/** "16" -> "16g"; lettered gauges such as "15L" or "1.25mm" stay as they are. */
export function formatGauge(gauge) {
  const text = clean(gauge);
  return /^\d+(\.\d+)?$/.test(text) ? `${text}g` : text;
}

/** One line per item: racket as the title, then string · gauge · tension. */
export function orderItemLine(item) {
  if (item?.item_type === "racket") {
    return { title: clean(item.label) || "New racket", detail: "New racket" };
  }
  if (item?.item_type === "custom") {
    const qty = Number(item.item_qty) || 1;
    return { title: `${clean(item.label) || "Item"}${qty > 1 ? ` × ${qty}` : ""}`, detail: "" };
  }
  const title = clean(item?.racket_make_model) || "Racket";
  const tension = formatTension(item?.tension_lbs_mains, item?.tension_lbs_crosses);
  if (item?.advice_requested && !tension && !clean(item?.gauge) && !clean(item?.custom_string_text)) {
    return { title, detail: "Setup decided at drop-off" };
  }
  // Strung with a new racket: labor was free.
  const parts = [itemStringName(item), formatGauge(item?.gauge), tension || "Stringer’s choice tension", item?.labor_waived ? "labor free" : ""];
  return { title, detail: parts.filter(Boolean).join(" · ") };
}

// ----- Money, links, shop -----

export const formatOrderTotal = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const cents = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** One item's price on the order: its unit price times how many. */
export const orderItemCents = (item) => cents(item?.unit_price_cents) * (Number(item?.item_qty) || 1);

/**
 * The receipt under the items, as the pay link shows it: stringing and string for the
 * restrings, then every other item (no lines when the API didn't say each restring's
 * string part), the subtotal, any discounts, sales tax and the total.
 */
export function orderReceipt(order) {
  const adjustments = [];
  const discount = cents(order?.discount_amount_cents);
  if (discount > 0) adjustments.push({ label: clean(order.discount_label) || "Discount", cents: -discount });
  const coachDiscount = cents(order?.coach_discount_cents);
  if (coachDiscount > 0) {
    const pct = cents(order.coach_purchase_discount_pct);
    adjustments.push({
      label: order.is_coach_purchase ? `Coach discount${pct ? ` (${pct}%)` : ""}` : "Discount from your coach",
      cents: -coachDiscount,
    });
  }
  return {
    lines: payLinkCostLines(Array.isArray(order?.items) ? order.items : []),
    subtotal: cents(order?.subtotal_cents),
    adjustments,
    tax: cents(order?.tax_cents),
    total: cents(order?.total_cents),
  };
}

/** The receipt as plain text, to share or copy: the shop and order, each item, the totals and the payment. */
export function orderReceiptText(order) {
  if (!order) return "";
  const signed = (value) => `${value < 0 ? "−" : ""}${formatOrderTotal(Math.abs(value))}`;
  const receipt = orderReceipt(order);
  const payment = orderPaymentLine(order);
  const placed = formatShopDate(order.created_at);
  const items = (Array.isArray(order.items) ? order.items : []).flatMap((item) => {
    const line = orderItemLine(item);
    // A custom item's title already says how many.
    const qty = item?.item_type === "custom" ? 1 : Number(item?.item_qty) || 1;
    return [
      `${line.title}${qty > 1 ? ` × ${qty}` : ""}: ${formatOrderTotal(orderItemCents(item))}`,
      ...(line.detail ? [`  ${line.detail}`] : []),
    ];
  });
  return [
    [clean(order.vendor_name), `Order #${order.id}`].filter(Boolean).join(" · "),
    ...(placed ? [`Placed ${placed}`] : []),
    "",
    ...items,
    "",
    `Subtotal: ${formatOrderTotal(receipt.subtotal)}`,
    ...receipt.adjustments.map((line) => `${line.label}: ${signed(line.cents)}`),
    ...(receipt.tax > 0 ? [`Sales tax: ${formatOrderTotal(receipt.tax)}`] : []),
    `Total: ${formatOrderTotal(receipt.total)}`,
    ...(payment ? [payment.label] : []),
  ].join("\n");
}

/** How the order was paid, for the receipt: "Paid by card · Fri, Oct 3", or what's still owed. */
export function orderPaymentLine(order) {
  const payment = clean(order?.payment_status).toLowerCase();
  const method = clean(order?.payment_method).toLowerCase();
  const on = (value) => (formatShopDate(value) ? ` · ${formatShopDate(value)}` : "");
  if (payment === "refunded") return { label: "Refunded", tone: "grey" };
  if (payment === "payment_failed") return { label: "Payment failed", tone: "red" };
  if (payment === "paid") {
    if (method === "comp" || cents(order.total_cents) === 0) return { label: "No payment needed", tone: "grey" };
    if (method === "in_person") return { label: `Paid at the shop${on(order.paid_at)}`, tone: "green" };
    if (order.stripe_payment_intent_id) return { label: `Paid by card${on(order.paid_at)}`, tone: "green" };
    return { label: `Paid${on(order.paid_at)}`, tone: "green" };
  }
  if (isCancelledOrder(order)) return { label: "Not charged", tone: "grey" };
  if (payment === "unpaid") {
    return { label: isRacketSaleOrder(order) ? "Not paid yet · pay before pickup" : "Not paid yet · pay at drop-off", tone: "amber" };
  }
  return null;
}

export function directionsUrl(address) {
  const text = clean(address);
  return text ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}` : "";
}

export const displayAddress = (address) => clean(address).replace(/,\s*USA$/i, "");

const restringItem = (order) =>
  (Array.isArray(order?.items) ? order.items : []).find((item) => item?.item_type !== "custom" && item?.service_tier_id) || null;

/** Link to the shop's page with this order's setup filled in; "" when it can't be rebuilt. */
export function restringAgainHref(order, item = restringItem(order)) {
  const slug = vendorSlug(order?.vendor_name);
  const search = item ? vendorPagePrefillSearch(item) : "";
  return slug && search ? `/${slug}${search}` : "";
}

const timeOf = (order) => new Date(order?.picked_up_at || order?.fulfilled_at || order?.created_at || 0).getTime() || 0;

const setupKey = (item) => `${clean(item?.racket_make_model).toLowerCase()}|${itemStringName(item).toLowerCase()}`;

/**
 * "Your usual setup": the racket + string combination picked up most often, ties going to the
 * most recent. With no repeats that is simply the latest picked-up restring.
 */
export function usualSetup(orders) {
  const seen = new Map();
  (Array.isArray(orders) ? orders : [])
    .filter((order) => COMPLETED_STATUSES.includes(statusOf(order)))
    .forEach((order) => {
      (Array.isArray(order.items) ? order.items : [])
        .filter((item) => item?.item_type !== "custom" && item?.service_tier_id)
        .forEach((item) => {
          const key = setupKey(item);
          const time = timeOf(order);
          const entry = seen.get(key) || { count: 0, latest: null };
          entry.count += 1;
          if (!entry.latest || time > entry.latest.time) entry.latest = { order, item, time };
          seen.set(key, entry);
        });
    });
  const best = [...seen.values()].sort(
    (left, right) => right.count - left.count || right.latest.time - left.latest.time,
  )[0];
  if (!best) return null;
  const { order, item } = best.latest;
  return {
    order,
    item,
    count: best.count,
    line: orderItemLine(item),
    href: restringAgainHref(order, item),
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

const shortWeekday = (label) => clean(label).split(",")[0];

/**
 * One line for the My orders row on Restring home:
 * "1 in progress · ready Sun", "2 in progress · ready now", "No restrings in progress · 5 past".
 */
export function ordersSummaryLine(orders) {
  const { active, past } = splitOrders(orders);
  if (!active.length) {
    return past.length ? `No restrings in progress · ${past.length} past` : "No restrings yet";
  }
  const lead = `${active.length} in progress`;
  if (active.some((order) => statusOf(order) === "ready_for_pickup")) return `${lead} · ready now`;
  const estimates = active
    .map((order) => ({ order, label: estimatedReadyDate(order) }))
    .filter((row) => row.label);
  if (estimates.length) {
    const soonest = estimates.sort(
      (left, right) => new Date(left.order.dropped_off_at) - new Date(right.order.dropped_off_at),
    )[0];
    return `${lead} · ready ${shortWeekday(soonest.label)}`;
  }
  return `${lead} · drop off to start`;
}
