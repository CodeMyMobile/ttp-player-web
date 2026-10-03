import assert from "node:assert/strict";
import test from "node:test";
import {
  STRING_CHOICE,
  buildVendorPageCheckoutItem,
  clampTension,
  clearOrderDraft,
  gaugeChoiceForString,
  loadOrderDraft,
  orderSelectionGaps,
  parseVendorHours,
  saveOrderDraft,
  tensionConfigForCategory,
  vendorHoursSummary,
  vendorOpenStatus,
} from "./vendorPage.js";

// The production shape for vendor 1.
const HOURS = {
  mon: "08:00-20:00",
  tue: "08:00-20:00",
  wed: "08:00-20:00",
  thu: "08:00-20:00",
  fri: "08:00-20:00",
  sat: "08:00-20:00",
  sun: "08:00-17:00",
};

// 2026-10-02 is a Friday. Los Angeles is UTC-7 in October.
const laTime = (isoLocal) => new Date(`${isoLocal}-07:00`);

test("parseVendorHours returns Mon–Sun rows with readable times", () => {
  const days = parseVendorHours(HOURS);
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((day) => day.key), ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  assert.equal(days[0].text, "8 AM – 8 PM");
  assert.equal(days[6].text, "8 AM – 5 PM");
});

test("parseVendorHours treats missing, null and unparseable days as closed", () => {
  const days = parseVendorHours({ mon: "09:30-17:00", tue: null, wed: "closed", thu: "17:00-09:00" });
  assert.equal(days[0].text, "9:30 AM – 5 PM");
  assert.deepEqual(days.slice(1).map((day) => day.closed), [true, true, true, true, true, true]);
});

test("parseVendorHours returns null when there is nothing to show", () => {
  assert.equal(parseVendorHours(null), null);
  assert.equal(parseVendorHours("Mon-Sat 9 AM - 7 PM"), null);
  assert.equal(parseVendorHours({}), null);
});

test("vendorOpenStatus reports open until closing time in the shop's timezone", () => {
  assert.deepEqual(vendorOpenStatus(HOURS, laTime("2026-10-02T10:15:00")), {
    isOpen: true,
    todayKey: "fri",
    label: "Open now · until 8 PM",
  });
});

test("vendorOpenStatus uses the shop's clock, not the viewer's", () => {
  // 03:30 UTC Saturday is 8:30 PM Friday in Los Angeles: closed, opens tomorrow.
  const status = vendorOpenStatus(HOURS, new Date("2026-10-03T03:30:00Z"));
  assert.equal(status.todayKey, "fri");
  assert.equal(status.isOpen, false);
  assert.equal(status.label, "Closed · opens tomorrow 8 AM");
});

test("vendorOpenStatus covers before opening, closing time and closed days", () => {
  assert.equal(vendorOpenStatus(HOURS, laTime("2026-10-02T07:00:00")).label, "Closed · opens 8 AM");
  assert.equal(vendorOpenStatus(HOURS, laTime("2026-10-02T20:00:00")).isOpen, false);
  const weekdaysOnly = { mon: "09:00-17:00", tue: "09:00-17:00" };
  assert.equal(vendorOpenStatus(weekdaysOnly, laTime("2026-10-02T12:00:00")).label, "Closed · opens Mon 9 AM");
  assert.equal(vendorOpenStatus(null), null);
});

test("vendorHoursSummary groups consecutive days with the same hours", () => {
  assert.equal(vendorHoursSummary(HOURS), "Mon–Sat 8 AM – 8 PM, Sun 8 AM – 5 PM");
  assert.equal(
    vendorHoursSummary({ mon: "09:00-17:00", tue: "09:00-17:00", thu: "09:00-17:00", sat: "10:00-14:00" }),
    "Mon–Tue 9 AM – 5 PM, Thu 9 AM – 5 PM, Sat 10 AM – 2 PM",
  );
});

test("vendorHoursSummary is empty when there are no usable hours", () => {
  assert.equal(vendorHoursSummary(null), "");
  assert.equal(vendorHoursSummary("Mon-Sat 9 AM - 7 PM"), "");
});

test("tensionConfigForCategory mirrors the admin values and falls back to a wide range", () => {
  assert.deepEqual(tensionConfigForCategory("std_poly"), { defaultLbs: 50, minLbs: 48, maxLbs: 52, isFallback: false });
  assert.deepEqual(tensionConfigForCategory("syn_gut"), { defaultLbs: 54, minLbs: 52, maxLbs: 56, isFallback: false });
  assert.deepEqual(tensionConfigForCategory("nat_gut"), { defaultLbs: 52, minLbs: 40, maxLbs: 65, isFallback: true });
});

test("clampTension keeps the stepper inside the category range", () => {
  assert.equal(clampTension(47, "std_poly"), 48);
  assert.equal(clampTension(60, "std_poly"), 52);
  assert.equal(clampTension(55, "prem_multi"), 55);
  assert.equal(clampTension(undefined, "std_poly"), 50);
});

test("gaugeChoiceForString asks only when a string comes in more than one gauge", () => {
  assert.deepEqual(gaugeChoiceForString({ gauges: ["16", "17"], gauges_stocked: ["16", "17"] }), {
    gauges: ["16", "17"],
    defaultGauge: "16",
    needsChoice: true,
  });
  assert.deepEqual(gaugeChoiceForString({ gauges: ["17"], gauges_stocked: ["17"] }), {
    gauges: ["17"],
    defaultGauge: "17",
    needsChoice: false,
  });
  assert.deepEqual(gaugeChoiceForString(null), { gauges: [], defaultGauge: null, needsChoice: false });
});

const POLY_TIER = { id: 5, string_category: "std_poly" };
const OWN_TIER = { id: 1, string_category: null };

test("orderSelectionGaps lists what is missing before Book", () => {
  assert.deepEqual(orderSelectionGaps({}), ["service"]);
  assert.deepEqual(orderSelectionGaps({ tier: POLY_TIER }), ["string", "racket"]);
  assert.deepEqual(
    orderSelectionGaps({ tier: POLY_TIER, stringChoice: STRING_CHOICE.SPECIFIED, stringId: 12, racketMakeModel: "Pure Aero" }),
    ["gauge"],
  );
  assert.deepEqual(orderSelectionGaps({ tier: OWN_TIER, ownStringText: " ", racketMakeModel: "Pure Aero" }), ["string"]);
  assert.deepEqual(
    orderSelectionGaps({ tier: POLY_TIER, stringChoice: STRING_CHOICE.SHOP, racketMakeModel: "Pure Aero" }),
    [],
  );
});

test("buildVendorPageCheckoutItem maps stringer's pick with a set tension", () => {
  assert.deepEqual(
    buildVendorPageCheckoutItem({
      tier: POLY_TIER,
      stringChoice: STRING_CHOICE.SHOP,
      stringId: 12,
      gauge: "17",
      tensionLbs: 51,
      racketMakeModel: " Babolat Pure Aero ",
    }),
    {
      service_tier_id: 5,
      string_selection: "shop_choice",
      string_id: null,
      custom_string_text: null,
      own_string_text: null,
      gauge: null,
      tension_lbs_mains: 51,
      tension_lbs_crosses: 51,
      advice_requested: false,
      racket_make_model: "Babolat Pure Aero",
      notes: null,
    },
  );
});

test("buildVendorPageCheckoutItem keeps the string and gauge when the stringer chooses the tension", () => {
  const item = buildVendorPageCheckoutItem({
    tier: POLY_TIER,
    stringChoice: STRING_CHOICE.SPECIFIED,
    stringId: "12",
    gauge: "17",
    tensionLbs: 50,
    stringerChoosesTension: true,
    racketMakeModel: "Pure Aero",
  });
  assert.equal(item.string_selection, "specified");
  assert.equal(item.string_id, 12);
  assert.equal(item.gauge, "17");
  assert.equal(item.advice_requested, false);
  assert.equal(item.tension_lbs_mains, null);
  assert.equal(item.tension_lbs_crosses, null);
  assert.equal(item.notes, "Tension: stringer's choice");
});

test("buildVendorPageCheckoutItem maps the player's own string", () => {
  const item = buildVendorPageCheckoutItem({
    tier: OWN_TIER,
    stringChoice: STRING_CHOICE.SHOP,
    ownStringText: " RPM Blast 17 ",
    tensionLbs: 52,
    racketMakeModel: "Pure Aero",
  });
  assert.equal(item.string_selection, "player_supplied");
  assert.equal(item.own_string_text, "RPM Blast 17");
  assert.equal(item.string_id, null);
  assert.equal(item.gauge, null);
  assert.equal(item.tension_lbs_mains, 52);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("order drafts survive sign-in, are kept per vendor and expire after a day", () => {
  const storage = memoryStorage();
  const draft = { tierId: 5, stringChoice: "shop_choice", tensionLbs: 51, racketMakeModel: "Pure Aero" };
  const savedAt = Date.parse("2026-10-02T17:00:00Z");

  assert.equal(saveOrderDraft(1, draft, { storage, now: savedAt }), true);
  assert.deepEqual(loadOrderDraft(1, { storage, now: savedAt + 60_000 }), draft);
  assert.equal(loadOrderDraft(2, { storage, now: savedAt }), null);
  assert.equal(loadOrderDraft(1, { storage, now: savedAt + 25 * 60 * 60 * 1000 }), null);

  clearOrderDraft(1, { storage });
  assert.equal(loadOrderDraft(1, { storage, now: savedAt }), null);
});

test("order drafts fail quietly when storage is unavailable", () => {
  const broken = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(saveOrderDraft(1, {}, { storage: broken }), false);
  assert.equal(loadOrderDraft(1, { storage: broken }), null);
  assert.doesNotThrow(() => clearOrderDraft(1, { storage: broken }));
  assert.equal(saveOrderDraft(1, {}, { storage: null }), false);
});
