import assert from "node:assert/strict";
import test from "node:test";

import { levelFromNtrp, rankCategories, recommendFromQuiz, reasonsFor, tensionFor, QUIZ_QUESTIONS } from "./quizV2.js";

const tiers = [
  { id: 1, price_cents: 2999, string_category: null, string_composition: null },
  { id: 2, price_cents: 3999, string_category: "syn_gut" },
  { id: 3, price_cents: 4499, string_category: "std_multi" },
  { id: 4, price_cents: 4999, string_category: "prem_multi" },
  { id: 5, price_cents: 4499, string_category: "std_poly" },
  { id: 6, price_cents: 4999, string_category: "prem_poly" },
  { id: 7, price_cents: 4999, string_category: null, string_composition: "poly_multi_hybrid" },
];
const catalog = [
  { id: 10, brand: "Prince", name: "Synthetic Gut", category: "syn_gut" },
  { id: 11, brand: "Head", name: "Velocity MLT", category: "std_multi" },
  { id: 14, brand: "Wilson", name: "NXT", category: "prem_multi" },
  { id: 15, brand: "Babolat", name: "RPM Blast", category: "std_poly" },
  { id: 13, brand: "Luxilon", name: "ALU Power", category: "prem_poly" },
  { id: 12, brand: "Solinco", name: "Hyper-G", category: "prem_poly" },
];

test("level is the first question, with the four bands", () => {
  assert.equal(QUIZ_QUESTIONS[0].key, "level");
  assert.deepEqual(QUIZ_QUESTIONS.map((q) => q.key), ["level", "arm", "priority", "frequency"]);
  assert.deepEqual(QUIZ_QUESTIONS[2].options.map((o) => o.value), ["spin", "control", "power", "comfort"]);
});

test("NTRP pre-selects a level; Competitive is never assumed", () => {
  assert.equal(levelFromNtrp(2.5), "getting_started");
  assert.equal(levelFromNtrp(3.0), "getting_started");
  assert.equal(levelFromNtrp(3.5), "intermediate");
  assert.equal(levelFromNtrp(4.25), "intermediate");
  assert.equal(levelFromNtrp(4.5), "advanced");
  assert.equal(levelFromNtrp(6.5), "advanced");
  assert.equal(levelFromNtrp(null), null);
  assert.equal(levelFromNtrp(0), null);
});

test("a sore arm never gets polyester", () => {
  for (const level of ["getting_started", "intermediate", "advanced", "competitive"]) {
    for (const priority of ["spin", "control", "power", "comfort"]) {
      const ranked = rankCategories({ level, arm: "yes", priority, frequency: "most_days" });
      assert.ok(ranked.every((c) => !c.includes("poly")), `${level}/${priority}: ${ranked}`);
    }
  }
});

test("the main paths", () => {
  assert.equal(rankCategories({ level: "advanced", arm: "no", priority: "spin", frequency: "few" })[0], "prem_poly");
  assert.equal(rankCategories({ level: "intermediate", arm: "no", priority: "control", frequency: "weekly" })[0], "std_poly");
  assert.equal(rankCategories({ level: "intermediate", arm: "no", priority: "comfort", frequency: "weekly" })[0], "std_multi");
  assert.equal(rankCategories({ level: "competitive", arm: "no", priority: "power", frequency: "few" })[0], "prem_multi");
  assert.equal(rankCategories({ level: "getting_started", arm: "no", priority: "spin", frequency: "weekly" })[0], "syn_gut");
  assert.equal(rankCategories({ level: "getting_started", arm: "no", priority: "comfort", frequency: "weekly" })[0], "std_multi");
  assert.equal(rankCategories({ level: "intermediate", arm: "no", priority: "power", frequency: "most_days" })[0], "prem_poly");
  assert.equal(rankCategories({ level: "advanced", arm: "sometimes", priority: "spin", frequency: "few" })[0], "poly_multi_hybrid");
});

test("the result: the shop's first in-stock string in the category, one alternative, reasons, tension", () => {
  const result = recommendFromQuiz({ level: "advanced", arm: "no", priority: "spin", frequency: "few" }, { tiers, catalog });
  assert.equal(result.pick.category, "prem_poly");
  assert.equal(result.pick.string.name, "ALU Power"); // Luxilon before Solinco
  assert.equal(result.pick.priceCents, 4999);
  assert.equal(result.alternative.category, "std_poly");
  assert.equal(result.alternative.string.name, "RPM Blast");
  assert.equal(result.tensionLbs, 50);
  assert.equal(result.warning, null);
  assert.ok(result.reasons.length >= 1 && result.reasons.length <= 3);
});

test("a category the shop can't do is skipped, not recommended empty", () => {
  const noPremPoly = catalog.filter((row) => row.category !== "prem_poly");
  const result = recommendFromQuiz({ level: "advanced", arm: "no", priority: "spin", frequency: "few" }, { tiers, catalog: noPremPoly });
  assert.equal(result.pick.category, "std_poly");
  assert.equal(recommendFromQuiz({ level: "advanced", arm: "no", priority: "spin" }, { tiers: [], catalog }), null);
});

test("a hybrid is the shop's choice: no string, its service price", () => {
  const result = recommendFromQuiz({ level: "advanced", arm: "sometimes", priority: "control", frequency: "few" }, { tiers, catalog });
  assert.equal(result.pick.kind, "preset");
  assert.equal(result.pick.string, null);
  assert.equal(result.pick.priceCents, 4999);
  assert.equal(result.tensionLbs, 48);
});

test("arm discomfort: a warning when it's now, and lower tension either way", () => {
  const result = recommendFromQuiz({ level: "intermediate", arm: "yes", priority: "spin", frequency: "few" }, { tiers, catalog });
  assert.equal(result.pick.category, "std_multi");
  assert.ok(result.warning);
  assert.equal(tensionFor("std_multi", { arm: "yes" }), 52);
  assert.equal(tensionFor("std_poly", { arm: "no" }), 50);
  assert.match(reasonsFor("std_multi", { arm: "yes" })[0], /arm/);
});

test("the hybrid is matched as production stores it: a category with stocked strings", () => {
  const prodTiers = [
    ...tiers.filter((tier) => !tier.string_composition),
    { id: 70, price_cents: 4999, string_category: "poly_multi", string_composition: null },
  ];
  const prodCatalog = [...catalog, { id: 30, brand: "Solinco", name: "Hyper-G / X-Natural", category: "poly_multi" }];
  const result = recommendFromQuiz({ level: "advanced", arm: "sometimes", priority: "control", frequency: "few" }, { tiers: prodTiers, catalog: prodCatalog });
  assert.equal(result.pick.tierId, 70);
  assert.equal(result.pick.kind, "string");
  assert.equal(result.pick.string.id, 30);
  assert.equal(result.tensionLbs, 48);
});

test("the pick costs the shop's price for that string when it has one", () => {
  const priced = catalog.map((row) => (row.name === "ALU Power" ? { ...row, string_price_cents: 2500, restring_price_cents: 5499 } : row));
  const result = recommendFromQuiz({ level: "advanced", arm: "no", priority: "spin", frequency: "few" }, { tiers, catalog: priced });
  assert.equal(result.pick.string.name, "ALU Power");
  assert.equal(result.pick.priceCents, 5499);
});
