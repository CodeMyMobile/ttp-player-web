import test from "node:test";
import assert from "node:assert/strict";

import { bestBetLine, bestBetsWithTimes, slotSet, slotsFromSet, toggleSlot } from "./availabilityGrid";

test("toggling cells and reading them back in grid order, Monday first", () => {
  let selected = slotSet([{ weekday: 0, bucket: "late_morning" }]);
  selected = toggleSlot(selected, { weekday: 2, bucket: "evening" });
  selected = toggleSlot(selected, { weekday: 2, bucket: "early_morning" });
  selected = toggleSlot(selected, { weekday: 2, bucket: "early_morning" });
  assert.deepEqual(slotsFromSet(selected), [
    { weekday: 2, bucket: "evening" },
    { weekday: 0, bucket: "late_morning" },
  ]);
});

test("toggleSlot leaves the original set alone", () => {
  const before = slotSet([]);
  toggleSlot(before, { weekday: 1, bucket: "night" });
  assert.equal(before.size, 0);
});

test("best bet line", () => {
  assert.equal(bestBetLine({ shared_count: 3, shared_days: ["Sat", "Sun", "Tue"] }), "3 shared times · Sat, Sun, Tue");
  assert.equal(bestBetLine({ shared_count: 1, shared_days: ["Tue"] }), "1 shared time · Tue");
  assert.equal(bestBetLine({ shared_count: 0, shared_days: [] }), null);
});

test("only opponents with a shared time are best bets", () => {
  const bet = (player_id: number, shared_count: number) => ({
    player_id,
    name: null,
    has_availability: true,
    shared_count,
    shared_days: [],
    windows: [],
  });
  assert.deepEqual(bestBetsWithTimes([bet(1, 2), bet(2, 0), bet(3, 1)]).map((b) => b.player_id), [1, 3]);
});
