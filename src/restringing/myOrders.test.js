import assert from "node:assert/strict";
import test from "node:test";
import {
  estimatedReadyDate,
  formatTension,
  orderItemLine,
  orderPaymentNote,
  orderProgressSteps,
  orderStatusChip,
  ordersSummaryLine,
  readyLine,
  restringAgainHref,
  spansVendors,
  splitOrders,
  updatedLabel,
  usualSetup,
  directionsUrl,
} from "./myOrders.js";
import { parseVendorPagePrefill, vendorPagePrefillSearch } from "./vendorPage.js";

const HOURS = {
  mon: "08:00-20:00",
  tue: "08:00-20:00",
  wed: "08:00-20:00",
  thu: "08:00-20:00",
  fri: "08:00-20:00",
  sat: "08:00-20:00",
};

const item = (overrides = {}) => ({
  id: 1,
  item_type: "restring",
  service_tier_id: 5,
  racket_make_model: "Babolat Pure Aero 98",
  string_selection: "specified",
  string_id: 2,
  string_brand: "Head",
  string_name: "Lynx Tour",
  custom_string_text: null,
  own_string_text: null,
  gauge: "16",
  tension_lbs_mains: "52.0",
  tension_lbs_crosses: "50.0",
  advice_requested: false,
  ...overrides,
});

const order = (overrides = {}) => ({
  id: 142,
  fulfillment_status: "pending",
  payment_status: "paid",
  vendor_name: "The Tennis Garage",
  vendor_address: "12625 Westminster Ave, Los Angeles, CA 90066, USA",
  vendor_hours: HOURS,
  vendor_turnaround_days: 1,
  total_cents: 4926,
  items: [item()],
  ...overrides,
});

test("splitOrders puts each status in Active or Past", () => {
  const statuses = ["pending", "dropped_off", "in_progress", "ready_for_pickup", "picked_up", "fulfilled", "cancelled"];
  const { active, past } = splitOrders(statuses.map((fulfillment_status, id) => ({ id, fulfillment_status })));
  assert.deepEqual(active.map((row) => row.fulfillment_status), statuses.slice(0, 4));
  assert.deepEqual(past.map((row) => row.fulfillment_status), statuses.slice(4));
});

test("orderStatusChip gives one chip per status", () => {
  const chip = (fulfillment_status) => orderStatusChip({ fulfillment_status });
  assert.deepEqual(chip("pending"), { label: "Drop off racket", tone: "amber" });
  assert.deepEqual(chip("dropped_off"), { label: "Stringing", tone: "purple" });
  assert.deepEqual(chip("in_progress"), { label: "Stringing", tone: "purple" });
  assert.deepEqual(chip("ready_for_pickup"), { label: "Ready for pickup", tone: "green" });
  assert.deepEqual(chip("fulfilled"), { label: "Picked up", tone: "grey" });
  assert.deepEqual(chip("cancelled"), { label: "Cancelled", tone: "red" });
});

test("orderPaymentNote shows exceptions only", () => {
  assert.equal(orderPaymentNote(order()), null);
  assert.equal(orderPaymentNote(order({ payment_method: "comp" })).label, "Comp");
  assert.equal(orderPaymentNote(order({ payment_status: "unpaid" })).label, "Pay at drop-off");
  assert.equal(orderPaymentNote(order({ fulfillment_status: "picked_up", payment_status: "unpaid" })), null);
  assert.deepEqual(orderPaymentNote(order({ payment_status: "payment_failed" })), { label: "Payment failed", tone: "red" });
  assert.equal(orderPaymentNote(order({ fulfillment_status: "cancelled", payment_status: "refunded" })).label, "Refunded");
  assert.equal(orderPaymentNote(order({ fulfillment_status: "cancelled", payment_status: "cancelled" })), null);
});

test("orderProgressSteps marks Stringing done once the order is ready, even if it was skipped", () => {
  const steps = orderProgressSteps(order({
    fulfillment_status: "ready_for_pickup",
    dropped_off_at: "2026-10-02T17:00:00Z",
    ready_at: "2026-10-03T20:00:00Z",
  }));
  assert.deepEqual(steps.map((step) => step.state), ["done", "done", "done", "current"]);
  assert.equal(steps[0].date, "Fri, Oct 2");
  assert.equal(steps[2].date, "Sat, Oct 3");
});

test("orderProgressSteps for a pending and a stringing order", () => {
  assert.deepEqual(orderProgressSteps(order()).map((step) => step.state), ["current", "todo", "todo", "todo"]);
  assert.deepEqual(
    orderProgressSteps(order({ fulfillment_status: "in_progress", dropped_off_at: "2026-10-02T17:00:00Z" })).map((step) => step.state),
    ["done", "current", "todo", "todo"],
  );
});

test("estimatedReadyDate counts turnaround days on the shop's calendar and skips closed days", () => {
  // Saturday 3 Oct, 10 AM in Los Angeles; Sunday is closed, so one day later is Monday.
  assert.equal(estimatedReadyDate(order({ dropped_off_at: "2026-10-03T17:00:00Z" })), "Mon, Oct 5");
  // Friday 9 PM in Los Angeles is already Saturday in UTC; the shop's date is what counts.
  assert.equal(estimatedReadyDate(order({ dropped_off_at: "2026-10-03T04:00:00Z" })), "Sat, Oct 3");
  assert.equal(estimatedReadyDate(order({ dropped_off_at: "2026-10-03T17:00:00Z", vendor_hours: null })), "Sun, Oct 4");
  assert.equal(estimatedReadyDate(order()), null);
});

test("readyLine before drop-off gives the turnaround and today's hours", () => {
  const friday = new Date("2026-10-02T17:00:00Z");
  assert.equal(readyLine(order(), friday), "Ready 1 day after drop-off · Today 8 AM – 8 PM");
  assert.equal(readyLine(order({ vendor_turnaround_days: 3 }), new Date("2026-10-04T17:00:00Z")), "Ready 3 days after drop-off · Today closed");
  assert.equal(
    readyLine(order({ fulfillment_status: "dropped_off", dropped_off_at: "2026-10-03T17:00:00Z" })),
    "Estimated ready Mon, Oct 5",
  );
});

test("formatTension drops the decimal and splits mains and crosses", () => {
  assert.equal(formatTension("52.0", "50.0"), "52/50 lbs");
  assert.equal(formatTension("52.0", "52.0"), "52 lbs");
  assert.equal(formatTension("51.5", null), "51.5 lbs");
  assert.equal(formatTension(null, null), "");
});

test("orderItemLine names the string whichever way it was chosen", () => {
  assert.deepEqual(orderItemLine(item()), { title: "Babolat Pure Aero 98", detail: "Head Lynx Tour · 16g · 52/50 lbs" });
  assert.equal(orderItemLine(item({ gauge: "15L" })).detail, "Head Lynx Tour · 15L · 52/50 lbs");
  assert.equal(
    orderItemLine(item({ string_brand: null, string_name: null, string_id: null, own_string_text: "RPM Blast 17", gauge: null })).detail,
    "Own string: RPM Blast 17 · 52/50 lbs",
  );
  assert.equal(
    orderItemLine(item({ string_brand: null, string_name: null, string_id: null, gauge: null, tension_lbs_mains: null, tension_lbs_crosses: null })).detail,
    "Stringer’s choice · Stringer’s choice tension",
  );
  assert.equal(
    orderItemLine(item({ string_brand: null, string_name: null, string_id: null, gauge: null, tension_lbs_mains: null, tension_lbs_crosses: null, advice_requested: true })).detail,
    "Setup decided at drop-off",
  );
  assert.deepEqual(orderItemLine({ item_type: "custom", label: "Overgrip", item_qty: 3 }), { title: "Overgrip × 3", detail: "" });
});

test("restringAgainHref rebuilds the setup on the shop's page", () => {
  assert.equal(
    restringAgainHref(order({ fulfillment_status: "picked_up" })),
    "/thetennisgarage?tier=5&string=2&gauge=16&tension=52&racket=Babolat+Pure+Aero+98",
  );
  assert.equal(restringAgainHref(order({ items: [{ item_type: "custom", label: "Grip" }] })), "");
});

test("vendor page prefill round-trips stringer's choice and own string", () => {
  const search = vendorPagePrefillSearch(item({
    string_id: null, string_brand: null, string_name: null, own_string_text: "RPM Blast 17",
    tension_lbs_mains: null, tension_lbs_crosses: null, service_tier_id: 1,
  }));
  assert.equal(search, "?tier=1&own=RPM+Blast+17&tension=stringer&racket=Babolat+Pure+Aero+98");
  assert.deepEqual(parseVendorPagePrefill(search), {
    tierId: 1,
    stringChoice: "shop_choice",
    stringId: null,
    gauge: null,
    ownStringText: "RPM Blast 17",
    tensionLbs: null,
    stringerChoosesTension: true,
    racketMakeModel: "Babolat Pure Aero 98",
  });
  assert.equal(parseVendorPagePrefill("?string=2"), null);
  assert.equal(parseVendorPagePrefill(""), null);
  assert.equal(parseVendorPagePrefill("?tier=5&string=2&gauge=17&tension=50").stringChoice, "specified");
});

test("usualSetup prefers the most frequent racket and string, ties going to the latest", () => {
  const done = (id, when, overrides) => order({ id, fulfillment_status: "picked_up", picked_up_at: when, items: [item(overrides)] });
  const orders = [
    done(1, "2026-06-01T17:00:00Z", { racket_make_model: "Wilson Blade 98" }),
    done(2, "2026-07-01T17:00:00Z", { racket_make_model: "Wilson Blade 98" }),
    done(3, "2026-09-01T17:00:00Z", { racket_make_model: "Head Speed MP" }),
  ];
  const setup = usualSetup(orders);
  assert.equal(setup.order.id, 2);
  assert.equal(setup.count, 2);
  assert.equal(setup.line.title, "Wilson Blade 98");
  // Same racket, different string: not the same setup.
  orders.push(done(4, "2026-09-15T17:00:00Z", { racket_make_model: "Wilson Blade 98", string_brand: "Wilson", string_name: "NXT" }));
  assert.equal(usualSetup(orders).order.id, 2);
  // A tie goes to the most recent.
  orders.push(done(5, "2026-09-20T17:00:00Z", { racket_make_model: "Head Speed MP" }));
  assert.equal(usualSetup(orders).order.id, 5);
});

test("usualSetup comes from the latest picked-up order", () => {
  const older = order({ id: 1, fulfillment_status: "fulfilled", picked_up_at: "2026-08-01T17:00:00Z" });
  const newer = order({
    id: 2,
    fulfillment_status: "picked_up",
    picked_up_at: "2026-09-01T17:00:00Z",
    items: [item({ racket_make_model: "Wilson Blade 98" })],
  });
  const setup = usualSetup([older, order({ id: 3 }), newer, order({ id: 4, fulfillment_status: "cancelled" })]);
  assert.equal(setup.order.id, 2);
  assert.equal(setup.line.title, "Wilson Blade 98");
  assert.equal(usualSetup([order()]), null);
});

test("directionsUrl and updatedLabel", () => {
  assert.equal(
    directionsUrl("12625 Westminster Ave, Los Angeles, CA 90066, USA"),
    "https://www.google.com/maps/dir/?api=1&destination=12625%20Westminster%20Ave%2C%20Los%20Angeles%2C%20CA%2090066%2C%20USA",
  );
  assert.equal(directionsUrl(""), "");
  const now = Date.parse("2026-10-04T12:00:00Z");
  assert.equal(updatedLabel(now - 20_000, now), "Updated just now");
  assert.equal(updatedLabel(now - 5 * 60_000, now), "Updated 5 min ago");
  assert.equal(updatedLabel(null, now), "");
});

test("spansVendors is true only for orders from more than one shop", () => {
  assert.equal(spansVendors([order(), order({ id: 2 })]), false);
  assert.equal(spansVendors([order(), order({ id: 2, vendor_id: 7, vendor_name: "Racket Lab" })]), true);
  assert.equal(spansVendors([]), false);
});


test("ordersSummaryLine sums up orders for Restring home", () => {
  const picked = order({ id: 1, fulfillment_status: "picked_up" });
  assert.equal(ordersSummaryLine([]), "No restrings yet");
  assert.equal(ordersSummaryLine([picked, order({ id: 2, fulfillment_status: "cancelled" })]), "No restrings in progress · 2 past");
  assert.equal(ordersSummaryLine([order({ id: 3 }), picked]), "1 in progress · drop off to start");
  assert.equal(
    ordersSummaryLine([order({ id: 4, fulfillment_status: "dropped_off", dropped_off_at: "2026-10-03T17:00:00Z" })]),
    "1 in progress · ready Mon",
  );
  assert.equal(
    ordersSummaryLine([order({ id: 5, fulfillment_status: "ready_for_pickup" }), order({ id: 6 })]),
    "2 in progress · ready now",
  );
});
