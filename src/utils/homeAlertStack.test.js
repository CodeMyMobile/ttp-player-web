import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeAlerts, restringPickupAlerts, sortHomeAlerts } from "./homeAlertStack";

const readyOrder = (overrides = {}) => ({
  id: 42,
  status: "ready_for_pickup",
  vendor_name: "Tennis Garage",
  ...overrides,
});

test("a ready order becomes one pickup alert", () => {
  const [alert] = restringPickupAlerts([readyOrder()]);

  assert.equal(alert.type, "restring_pickup");
  assert.equal(alert.title, "Ready for pickup");
  assert.equal(alert.subtitle, "Tennis Garage");
  assert.equal(alert.destination, "/restring");
  assert.equal(alert.id, "restring-42");
});

test("either status column can mark an order ready", () => {
  assert.equal(restringPickupAlerts([readyOrder({ status: "in_progress" })]).length, 0);
  assert.equal(
    restringPickupAlerts([readyOrder({ status: "in_progress", fulfillment_status: "ready_for_pickup" })])
      .length,
    1,
  );
});

test("orders that are not ready produce nothing", () => {
  const alerts = restringPickupAlerts([
    readyOrder({ status: "dropped_off" }),
    readyOrder({ status: "collected" }),
    readyOrder({ status: null, fulfillment_status: null }),
    readyOrder({ status: "" }),
  ]);

  assert.deepEqual(alerts, []);
});

test("the pickup subtitle is the vendor alone, or nothing", () => {
  // The mockup reads "Tennis Garage · Penmar", but an order carries no location
  // field. The vendor ships alone rather than the location being invented.
  const [withVendor] = restringPickupAlerts([readyOrder()]);
  assert.equal(withVendor.subtitle, "Tennis Garage");
  assert.ok(!withVendor.subtitle.includes("·"));

  const [noVendor] = restringPickupAlerts([readyOrder({ vendor_name: "  " })]);
  assert.equal(noVendor.subtitle, null);
});

test("an order with no id is dropped rather than given a made-up key", () => {
  assert.deepEqual(restringPickupAlerts([readyOrder({ id: null })]), []);
  assert.deepEqual(restringPickupAlerts([readyOrder({ id: "" })]), []);
});

test("no orders means no alerts, and junk input does not throw", () => {
  assert.deepEqual(buildHomeAlerts(), []);
  assert.deepEqual(buildHomeAlerts({ restringOrders: [] }), []);
  assert.deepEqual(buildHomeAlerts({ restringOrders: null }), []);
  assert.deepEqual(restringPickupAlerts(undefined), []);
  assert.deepEqual(restringPickupAlerts([null, undefined, 7]), []);
});

test("unentered_score is never emitted, whatever the input", () => {
  // The component renders the type, but there is no endpoint behind it — so no
  // builder may produce one. This is the guard against a placeholder row.
  const alerts = buildHomeAlerts({
    restringOrders: [readyOrder(), readyOrder({ id: 43, status: "collected" })],
  });

  assert.ok(alerts.every((alert) => alert.type !== "unentered_score"));
  assert.ok(alerts.every((alert) => alert.type === "restring_pickup"));
});

test("alerts sort most urgent first, undated last", () => {
  const sorted = sortHomeAlerts([
    { id: "c", deadlineAt: null },
    { id: "a", deadlineAt: 1_000 },
    { id: "b", deadlineAt: 2_000 },
  ]);

  assert.deepEqual(
    sorted.map((alert) => alert.id),
    ["a", "b", "c"],
  );
});

test("sorting does not mutate the caller's array", () => {
  const input = [
    { id: "b", deadlineAt: 2_000 },
    { id: "a", deadlineAt: 1_000 },
  ];
  sortHomeAlerts(input);

  assert.deepEqual(
    input.map((alert) => alert.id),
    ["b", "a"],
  );
});
