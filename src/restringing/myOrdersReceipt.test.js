import assert from "node:assert/strict";
import test from "node:test";
import { orderItemCents, orderPaymentLine, orderReceipt } from "./myOrders.js";

// A paid order as GET /player/restringing/orders returns it: two restrings, an add-on, a code, tax.
const ORDER = {
  id: 142,
  fulfillment_status: "ready_for_pickup",
  payment_status: "paid",
  payment_method: null,
  stripe_payment_intent_id: "pi_1",
  paid_at: "2026-10-03T18:00:00Z",
  subtotal_cents: 9500,
  discount_label: "FALL10",
  discount_amount_cents: 950,
  coach_discount_cents: 0,
  tax_cents: 412,
  total_cents: 8962,
  items: [
    { id: 1, item_type: "restring", unit_price_cents: "4000", taxable_unit_cents: "2200", item_qty: 2 },
    { id: 2, item_type: "custom", label: "Overgrip 3-pack", unit_price_cents: 1500, taxable_unit_cents: 1500, item_qty: 1, add_on_offer_id: 7 },
  ],
};

test("the receipt splits stringing from string, then lists the other items, discounts, tax and total", () => {
  assert.deepEqual(orderReceipt(ORDER), {
    lines: [
      { label: "Stringing × 2", cents: 3600 },
      { label: "Strings × 2", cents: 4400 },
      { label: "Overgrip 3-pack", cents: 1500 },
    ],
    subtotal: 9500,
    adjustments: [{ label: "FALL10", cents: -950 }],
    tax: 412,
    total: 8962,
  });
});

test("without each restring's string part, no split lines; the totals still show", () => {
  const receipt = orderReceipt({ ...ORDER, items: [{ id: 1, unit_price_cents: 4000, taxable_unit_cents: null }] });
  assert.deepEqual(receipt.lines, []);
  assert.equal(receipt.total, 8962);
});

test("a coach's discount is named for who gave it", () => {
  const fromCoach = orderReceipt({ ...ORDER, discount_amount_cents: 0, coach_discount_cents: 500 });
  assert.deepEqual(fromCoach.adjustments, [{ label: "Discount from your coach", cents: -500 }]);
  const ownPurchase = orderReceipt({ ...ORDER, discount_amount_cents: 0, coach_discount_cents: 500, is_coach_purchase: true, coach_purchase_discount_pct: 15 });
  assert.deepEqual(ownPurchase.adjustments, [{ label: "Coach discount (15%)", cents: -500 }]);
});

test("an item's price is its unit price times how many", () => {
  assert.equal(orderItemCents(ORDER.items[0]), 8000);
  assert.equal(orderItemCents({ unit_price_cents: 1200 }), 1200);
});

test("the payment line says how it was paid, or what's still owed", () => {
  assert.deepEqual(orderPaymentLine(ORDER), { label: "Paid by card · Sat, Oct 3", tone: "green" });
  assert.equal(orderPaymentLine({ ...ORDER, payment_method: "in_person", stripe_payment_intent_id: null }).label, "Paid at the shop · Sat, Oct 3");
  assert.equal(orderPaymentLine({ ...ORDER, payment_method: "comp", total_cents: 0 }).label, "No payment needed");
  assert.equal(orderPaymentLine({ ...ORDER, payment_status: "refunded" }).label, "Refunded");
  assert.equal(orderPaymentLine({ ...ORDER, payment_status: "unpaid", fulfillment_status: "pending" }).label, "Not paid yet · pay at drop-off");
  assert.equal(orderPaymentLine({ ...ORDER, payment_status: "unpaid", fulfillment_status: "cancelled" }).label, "Not charged");
});
