import assert from "node:assert/strict";
import test from "node:test";
import { isRacketSaleOrder, orderItemLine, orderPaymentNote, orderProgressSteps, orderStatusChip, readyLine } from "./myOrders.js";

const racket = { id: 1, item_type: "racket", label: "Solinco Whiteout 305 (grip 4 3/8)" };
const stringJob = { id: 2, item_type: "restring", service_tier_id: 2, racket_make_model: "Solinco Whiteout 305", string_brand: "Solinco", string_name: "Hyper-G", gauge: "16L", tension_lbs_mains: 52, tension_lbs_crosses: 52, labor_waived: true };
const order = { id: 42, fulfillment_status: "pending", payment_status: "unpaid", created_at: "2026-11-01T16:00:00Z", items: [racket, stringJob] };

test("a new racket isn't dropped off", () => {
  assert.equal(isRacketSaleOrder(order), true);
  assert.deepEqual(orderStatusChip(order), { label: "Being prepared", tone: "purple" });
  assert.deepEqual(orderPaymentNote(order), { label: "Pay before pickup", tone: "amber" });
  assert.equal(readyLine(order), "The shop is getting it ready");
  assert.deepEqual(orderProgressSteps(order).map((step) => [step.label, step.state]), [
    ["Ordered", "done"],
    ["Ready", "current"],
    ["Picked up", "todo"],
  ]);
  assert.deepEqual(
    orderProgressSteps({ ...order, fulfillment_status: "ready_for_pickup" }).map((step) => step.state),
    ["done", "done", "current"],
  );
});

test("the racket and its free-labor string job are listed", () => {
  assert.deepEqual(orderItemLine(racket), { title: "Solinco Whiteout 305 (grip 4 3/8)", detail: "New racket" });
  assert.deepEqual(orderItemLine(stringJob), { title: "Solinco Whiteout 305", detail: "Solinco Hyper-G · 16L · 52 lbs · labor free" });
});

test("restring orders keep their wording", () => {
  const restring = { ...order, items: [{ ...stringJob, labor_waived: false }] };
  assert.equal(isRacketSaleOrder(restring), false);
  assert.equal(orderStatusChip(restring).label, "Drop off racket");
  assert.equal(orderPaymentNote(restring).label, "Pay at drop-off");
});
