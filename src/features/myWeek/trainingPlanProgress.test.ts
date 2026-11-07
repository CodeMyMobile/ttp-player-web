process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { planDayFor, readPlanProgress, setDayDone, startPlan } from "./trainingPlanProgress";

const memory = () => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
};

test("day 1 is the start date, and the plan repeats after day 7", () => {
  assert.equal(planDayFor("2026-11-06", "2026-11-06"), 1);
  assert.equal(planDayFor("2026-11-12", "2026-11-06"), 7);
  assert.equal(planDayFor("2026-11-13", "2026-11-06"), 1);
  assert.equal(planDayFor("2026-11-15", "2026-11-06"), 3);
  assert.equal(planDayFor("2026-11-05", "2026-11-06"), null);
});

test("the day count holds across the end of daylight saving", () => {
  // 1 Nov 2026 is 25 hours long in Los Angeles.
  assert.equal(planDayFor("2026-11-02", "2026-10-31"), 3);
});

test("starting, ticking and unticking are remembered on the device", () => {
  const storage = memory();
  assert.equal(readPlanProgress(storage), null);
  startPlan(new Date(2026, 10, 6, 9, 0), storage);
  assert.deepEqual(readPlanProgress(storage), { startedOn: "2026-11-06", done: {} });
  setDayDone("2026-11-06", true, storage);
  assert.deepEqual(readPlanProgress(storage)?.done, { "2026-11-06": true });
  setDayDone("2026-11-06", false, storage);
  assert.deepEqual(readPlanProgress(storage)?.done, {});
});

test("ticking before the plan starts does nothing; junk in storage reads as not started", () => {
  const storage = memory();
  assert.equal(setDayDone("2026-11-06", true, storage), null);
  storage.setItem("ttp_training_plan", "{not json");
  assert.equal(readPlanProgress(storage), null);
  storage.setItem("ttp_training_plan", JSON.stringify({ startedOn: "yesterday" }));
  assert.equal(readPlanProgress(storage), null);
});
