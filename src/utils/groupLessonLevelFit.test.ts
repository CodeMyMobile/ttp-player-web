import assert from "node:assert/strict";
import test from "node:test";

import { classLevelBand, fitsPlayerLevel, formatPlayerLevel, playerLevelOf } from "./groupLessonLevelFit.ts";

// Titles and labels as they are in production today.
const LIVE = {
  sal35: { title: "Culver City High 3.5+ Liveball with coach Sal", level: 3.5, skillLabel: "Intermediate (NTRP 3.5)" },
  liveball40: { title: "4.0 Liveball at Culver City High", level: 4, skillLabel: "Advanced (NTRP 4.0)" },
  liveball45: { title: "4.5+ Liveball at Culver City HS", level: 4.5, skillLabel: "Advanced Plus (NTRP 4.5)" },
  advBeginner: { title: "Culver Adv. Beginner Clinic with Coach Sal", level: 3, skillLabel: "Advanced Beginner (NTRP 3.0)" },
  intensive: { title: "Liveball Intensive (2h, curated 3.5-4.0 group)", level: null, skillLabel: "All levels" },
  chaparal: { title: "Chaparal Friday liveball", level: null, skillLabel: "All levels" },
};

test("reads the level from the title first, then the class's level", () => {
  assert.deepEqual(classLevelBand(LIVE.sal35), { min: 3.5, max: null });
  assert.deepEqual(classLevelBand(LIVE.liveball40), { min: 4, max: 4 });
  assert.deepEqual(classLevelBand(LIVE.liveball45), { min: 4.5, max: null });
  assert.deepEqual(classLevelBand(LIVE.advBeginner), { min: 3, max: 3 });
  assert.deepEqual(classLevelBand(LIVE.intensive), { min: 3.5, max: 4 });
  assert.equal(classLevelBand(LIVE.chaparal), null);
});

test("doesn't mistake times and durations for levels", () => {
  assert.equal(classLevelBand({ title: "Sunday 6.5 hour camp" }), null);
  assert.equal(classLevelBand({ title: "Drills at 7.0pm" }), null);
  assert.equal(classLevelBand({ title: "Cardio tennis 2h" }), null);
  assert.deepEqual(classLevelBand({ title: "Doubles 3.0 to 3.5" }), { min: 3, max: 3.5 });
  assert.equal(classLevelBand({ title: "Evening drills 6.30-7.30pm" }), null);
});

test("reads the external listings' ranges, including quarter levels", () => {
  assert.deepEqual(classLevelBand({ title: "Skills & Drills: 2.5 - 3.0" }), { min: 2.5, max: 3 });
  assert.deepEqual(classLevelBand({ title: "2.75 - 3.25 Live Ball" }), { min: 2.75, max: 3.25 });
  assert.deepEqual(classLevelBand({ title: "3.5-4.0 Ladies Liveball" }), { min: 3.5, max: 4 });
  assert.equal(fitsPlayerLevel(classLevelBand({ title: "2.75 - 3.25 Live Ball" }), 3), true);
  assert.equal(fitsPlayerLevel(classLevelBand({ title: "2.75 - 3.25 Live Ball" }), 3.5), true);
  assert.equal(fitsPlayerLevel(classLevelBand({ title: "Skills & Drills: 2.5 - 3.0" }), 3.5), false);
  assert.equal(fitsPlayerLevel(classLevelBand({ title: "2.75 - 3.25 Live Ball" }), 4.5), false);
});

test("a 3.5 player sees the 3.5 classes, not the 3.0 clinic or the 4.0 and 4.5+ liveballs", () => {
  const fits = Object.entries(LIVE)
    .filter(([, lesson]) => fitsPlayerLevel(classLevelBand(lesson), 3.5))
    .map(([name]) => name);
  assert.deepEqual(fits, ["sal35", "intensive", "chaparal"]);
});

test("a 4.5 player sees the 4.5+ liveball, not the 3.5 and 4.0 classes", () => {
  const fits = Object.entries(LIVE)
    .filter(([, lesson]) => fitsPlayerLevel(classLevelBand(lesson), 4.5))
    .map(([name]) => name);
  assert.deepEqual(fits, ["liveball45", "chaparal"]);
});

test("a class with no level is open to everyone", () => {
  assert.equal(fitsPlayerLevel(null, 2.5), true);
  assert.equal(fitsPlayerLevel(null, 5.5), true);
});

test("player level: played rating, then USTA, then quiz; zero is no level", () => {
  assert.equal(playerLevelOf({ calculated_ntrp: 3.75, matches_played: 4, usta_rating: 3.5 }), 3.75);
  assert.equal(playerLevelOf({ calculated_ntrp: 3.75, matches_played: 0, usta_rating: 3.5 }), 3.5);
  assert.equal(playerLevelOf({ usta_rating: "4.0", self_rated_seed: 3.5 }), 4);
  assert.equal(playerLevelOf({ usta_rating: null, self_rated_seed: 3.5 }), 3.5);
  assert.equal(playerLevelOf({ usta_rating: 0, self_rated_seed: 0, calculated_ntrp: null }), null);
  assert.equal(playerLevelOf(null), null);
});

test("chip shows the nearest half level", () => {
  assert.equal(formatPlayerLevel(3.67), "3.5");
  assert.equal(formatPlayerLevel(3.8), "4.0");
  assert.equal(formatPlayerLevel(4), "4.0");
});
