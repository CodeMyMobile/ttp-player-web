import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDuration, pickTipOfDay, readCachedTips, writeCachedTips } from "./tipOfDay";

const videos = ["a", "b", "c", "d", "e"];

// --- which video ------------------------------------------------------------

test("the same day always yields the same tip", () => {
  // "Of the day" has to mean something — a fresh pick per render would change
  // the video under someone mid-scroll.
  const morning = new Date(2026, 7, 21, 6, 0, 0);
  const evening = new Date(2026, 7, 21, 23, 59, 0);

  assert.equal(pickTipOfDay(videos, morning), pickTipOfDay(videos, evening));
});

test("the tip turns over at local midnight", () => {
  const today = pickTipOfDay(videos, new Date(2026, 7, 21, 12, 0, 0));
  const tomorrow = pickTipOfDay(videos, new Date(2026, 7, 22, 12, 0, 0));

  assert.notEqual(today, tomorrow);
});

test("consecutive days walk the list rather than jumping around", () => {
  const picks = Array.from({ length: 5 }, (_, i) =>
    pickTipOfDay(videos, new Date(2026, 7, 21 + i, 12, 0, 0)),
  );

  assert.equal(new Set(picks).size, 5, "five days should cover five distinct videos");
});

test("an empty playlist yields null, so no section renders", () => {
  assert.equal(pickTipOfDay([]), null);
  assert.equal(pickTipOfDay(null), null);
  assert.equal(pickTipOfDay([null, undefined]), null);
});

test("a single video is always the tip", () => {
  assert.equal(pickTipOfDay(["only"], new Date(2026, 7, 21)), "only");
  assert.equal(pickTipOfDay(["only"], new Date(2027, 0, 1)), "only");
});

// --- duration ---------------------------------------------------------------

test("durations read as a clock", () => {
  assert.equal(parseIsoDuration("PT4M12S"), "4:12");
  assert.equal(parseIsoDuration("PT45S"), "0:45");
  assert.equal(parseIsoDuration("PT1H2M3S"), "1:02:03");
  assert.equal(parseIsoDuration("PT10M"), "10:00");
  assert.equal(parseIsoDuration("PT1H"), "1:00:00");
});

test("an unreadable duration is null, never a broken badge", () => {
  for (const bad of ["", "  ", "4:12", "P1D", null, undefined, 42, "PT"]) {
    assert.equal(parseIsoDuration(bad), null, String(bad));
  }
});

// --- day cache --------------------------------------------------------------

const withStorage = (initial) => {
  const store = new Map(Object.entries(initial ?? {}));
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
  };
  return store;
};

test("the cache is used on the same day and ignored on the next", () => {
  const now = new Date(2026, 7, 21, 12, 0, 0);
  withStorage();
  writeCachedTips([{ videoId: "x", title: "T" }], now);

  assert.equal(readCachedTips(now).length, 1);
  assert.equal(readCachedTips(new Date(2026, 7, 22, 12, 0, 0)), null, "a new day refetches");
  delete globalThis.window;
});

test("corrupt or empty cached data means refetch, not a crash", () => {
  const now = new Date(2026, 7, 21, 12, 0, 0);
  for (const raw of ["{not json", "null", '{"day":"2026-08-21"}', '{"day":"2026-08-21","videos":[]}']) {
    withStorage({ "player:web:tip-of-day": raw });
    assert.equal(readCachedTips(now), null, raw);
  }
  delete globalThis.window;
});

test("no storage at all is survivable", () => {
  delete globalThis.window;
  assert.equal(readCachedTips(), null);
  assert.doesNotThrow(() => writeCachedTips([{ videoId: "x", title: "T" }]));
});
