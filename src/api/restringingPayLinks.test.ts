import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVendorTelHref,
  createRestringingPayLinkCheckout,
  formatPayLinkMoney,
  formatVendorHours,
  getItemSpecs,
  getRestringingPayLink,
  isRestringingPayLinkPaid,
  isPayLinkDemoMode,
  shouldShowAccountPrompt,
} from "./restringingPayLinks";

test("formatPayLinkMoney formats cents as USD", () => {
  assert.equal(formatPayLinkMoney(2999), "$29.99");
  assert.equal(formatPayLinkMoney(null), "$0.00");
});

test("buildVendorTelHref strips display formatting from vendor phone", () => {
  assert.equal(buildVendorTelHref("+1 (512) 555-0199"), "tel:+15125550199");
  assert.equal(buildVendorTelHref(null), "");
});

test("formatVendorHours renders vendor hours objects safely", () => {
  assert.equal(formatVendorHours({
    mon: "09:00-17:00",
    tue: "09:00-17:00",
    wed: "09:00-17:00",
    thu: "09:00-17:00",
    fri: "09:00-19:00",
    sat: "10:00-14:00",
    sun: "",
  }), "Mon 09:00-17:00 · Tue 09:00-17:00 · Wed 09:00-17:00 · Thu 09:00-17:00 · Fri 09:00-19:00 · Sat 10:00-14:00");
  assert.equal(formatVendorHours("Mon-Sat"), "Mon-Sat");
  assert.equal(formatVendorHours(null), "");
});

test("getItemSpecs returns a dashed TBD spec for advice orders", () => {
  assert.deepEqual(getItemSpecs({
    id: 1,
    advice_requested: true,
    gauge: null,
    tension_lbs_mains: null,
    tension_lbs_crosses: null,
  }), [{ label: "Specs", value: "TBD", sublabel: "at drop-off", pending: true }]);
});

test("getItemSpecs returns tension and gauge tiles for fixed-spec orders", () => {
  assert.deepEqual(getItemSpecs({
    id: 1,
    advice_requested: false,
    gauge: "16L",
    tension_lbs_mains: 52,
    tension_lbs_crosses: 50,
  }), [
    { label: "Tension", value: "52 / 50", sublabel: "lbs", pending: false },
    { label: "Gauge", value: "16L", sublabel: "", pending: false },
  ]);
});

test("getItemSpecs returns no racket specs for custom sale items", () => {
  assert.deepEqual(getItemSpecs({
    id: 2,
    item_type: "custom",
    label: "Balls",
    unit_price_cents: 500,
    item_qty: 2,
  }), []);
});

test("shouldShowAccountPrompt only returns true for login-available account links", () => {
  assert.equal(shouldShowAccountPrompt({ eligible: true, status: "login_available" }), true);
  assert.equal(shouldShowAccountPrompt({ eligible: true, status: "linked" }), false);
  assert.equal(shouldShowAccountPrompt({ eligible: false, status: "hidden" }), false);
});

test("pay-link demo mode is explicit, not implied by local dev", () => {
  assert.equal(isPayLinkDemoMode(""), false);
  assert.equal(isPayLinkDemoMode("?demo=1"), true);
  assert.equal(isPayLinkDemoMode("?demo=0"), false);
});

test("recognizes a paid pay-link summary", () => {
  assert.equal(isRestringingPayLinkPaid({ order: { payment_status: "paid" } }), true);
  assert.equal(isRestringingPayLinkPaid({ order: { payment_status: "unpaid" } }), false);
});

test("pay-link API uses public endpoints with optional auth", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      order: {
        id: 42,
        customer_first_name: "Alex",
        masked_phone: "•• 01 23",
        payment_status: "unpaid",
        fulfillment_status: "pending",
        subtotal_cents: 4200,
        discount_label: "Member",
        discount_type: "percent",
        discount_value: 10,
        discount_amount_cents: 420,
        tax_cents: 300,
        total_cents: 4500,
        items: [],
      },
      vendor: { name: "Austin Racket Shop", address: "12 Court St", phone: "+15125550999", hours: "Mon-Sat" },
      account_link: { eligible: true, status: "login_available" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const summary = await getRestringingPayLink("raw-token", "Token abc");
    assert.equal(summary.order.id, 42);
    assert.equal(summary.order.discount_amount_cents, 420);
    assert.equal(calls[0].url.endsWith("/restringing/pay-links/raw-token"), true);
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Token abc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout API returns client secret and connected account id", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      client_secret: "pi_123_secret",
      stripe_account_id: "acct_vendor",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const checkout = await createRestringingPayLinkCheckout("raw-token", "Token abc", {
      paymentMethodId: "pm_saved",
    });
    assert.deepEqual(checkout, { client_secret: "pi_123_secret", stripe_account_id: "acct_vendor" });
    assert.equal(calls[0].url.endsWith("/restringing/pay-links/raw-token/checkout"), true);
    assert.equal(calls[0].init?.method, "POST");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Token abc");
    assert.equal(calls[0].init?.body, JSON.stringify({ payment_method_id: "pm_saved" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
