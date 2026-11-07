import test from "node:test";
import assert from "node:assert/strict";

import { applyFlagOverridesFromUrl, isHomeV2Enabled, isMyWeekEnabled, isRestringV2Enabled } from "./featureFlags";

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => (items.has(key) ? (items.get(key) as string) : null),
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const withWindow = (storage: ReturnType<typeof memoryStorage>, run: () => void) => {
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  try {
    run();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
};

test("My Week and Home v2 are off with no build setting and no override", () => {
  withWindow(memoryStorage(), () => {
    assert.equal(isMyWeekEnabled(), false);
    assert.equal(isHomeV2Enabled(), false);
  });
});

test("?myweek=1 turns My Week on for this browser, before the # or inside the hash route", () => {
  const before = memoryStorage();
  applyFlagOverridesFromUrl({ search: "?myweek=1", hash: "#/" }, before);
  assert.equal(before.items.get("ttp_flag_my_week"), "1");

  const inside = memoryStorage();
  applyFlagOverridesFromUrl({ search: "", hash: "#/play?myweek=1&homev2=1" }, inside);
  withWindow(inside, () => {
    assert.equal(isMyWeekEnabled(), true);
    assert.equal(isHomeV2Enabled(), true);
  });
});

test("?myweek=0 turns it back off; other values leave it alone", () => {
  const storage = memoryStorage();
  storage.setItem("ttp_flag_my_week", "1");
  applyFlagOverridesFromUrl({ search: "?myweek=yes", hash: "" }, storage);
  assert.equal(storage.items.get("ttp_flag_my_week"), "1");
  applyFlagOverridesFromUrl({ search: "?myweek=0", hash: "" }, storage);
  assert.equal(storage.items.has("ttp_flag_my_week"), false);
});

test("a browser that refuses storage falls back to the build setting", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => applyFlagOverridesFromUrl({ search: "?myweek=1", hash: "" }, broken));
  (globalThis as { window?: unknown }).window = { localStorage: broken };
  try {
    assert.equal(isMyWeekEnabled(), false);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("?restringv2=1 turns the restring redesign on for this browser; it's off by default", () => {
  const storage = memoryStorage();
  withWindow(storage, () => {
    assert.equal(isRestringV2Enabled(), false);
    applyFlagOverridesFromUrl({ search: "", hash: "#/restring?restringv2=1" }, storage);
    assert.equal(isRestringV2Enabled(), true);
    applyFlagOverridesFromUrl({ search: "?restringv2=0", hash: "" }, storage);
    assert.equal(isRestringV2Enabled(), false);
  });
});
