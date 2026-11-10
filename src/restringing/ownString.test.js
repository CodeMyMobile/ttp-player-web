import test from "node:test";
import assert from "node:assert/strict";
import { matchOwnString, ownStringHint, ownStringResults, searchOwnStrings } from "./ownString.js";

const catalog = [
  { id: 1, brand: "Solinco", name: "Hyper-G", in_stock: false },
  { id: 2, brand: "Solinco", name: "Hyper-G Soft", in_stock: true },
  { id: 3, brand: "Luxilon", name: "ALU Power", in_stock: false },
  { id: 4, brand: "Babolat", name: "RPM Blast", in_stock: true },
  { id: 5, brand: "Wilson", name: "NXT", in_stock: false },
];

test("search: every word typed, anywhere in brand and name, gauges left out", () => {
  assert.deepEqual(searchOwnStrings("hyp", catalog).map((row) => row.id), ["2", "1"]);
  assert.deepEqual(searchOwnStrings("alu pow 16L", catalog).map((row) => row.name), ["Luxilon ALU Power"]);
  assert.deepEqual(searchOwnStrings("solinco hyper 1.25 mm", catalog).map((row) => row.id), ["2", "1"]);
  assert.deepEqual(searchOwnStrings("", catalog), []);
  assert.deepEqual(searchOwnStrings("17", catalog), []);
});

test("search: the shop's stock first, then a word starting with the first typed, then A to Z", () => {
  // "l": every name with an l; Babolat (in stock) first, then Luxilon (word starts with l).
  const names = searchOwnStrings("l", catalog).map((row) => row.name);
  assert.deepEqual(names.slice(0, 3), ["Babolat RPM Blast", "Solinco Hyper-G Soft", "Luxilon ALU Power"]);
  assert.equal(searchOwnStrings("o", catalog, 2).length, 2);
  assert.deepEqual(searchOwnStrings("rpm", catalog)[0], { id: "4", name: "Babolat RPM Blast", inStock: true });
});

test("match: the exact brand and name, maybe with a gauge, the longest name winning", () => {
  assert.equal(matchOwnString("solinco hyper-g", catalog)?.id, 1);
  assert.equal(matchOwnString("  Solinco  Hyper-G Soft 16L ", catalog)?.id, 2);
  assert.equal(matchOwnString("Luxilon ALU Power 1.25mm", catalog)?.id, 3);
  assert.equal(matchOwnString("Luxilon ALU Power 1.25 mm", catalog)?.id, 3);
  assert.equal(matchOwnString("Luxilon ALU", catalog), undefined);
  assert.equal(matchOwnString("Luxilon ALU Power rough", catalog), undefined);
  assert.equal(matchOwnString("", catalog), undefined);
});

test("results close once a pick is left as picked; typing over opens them again", () => {
  assert.deepEqual(ownStringResults("Babolat RPM Blast", "4", catalog), []);
  assert.deepEqual(ownStringResults("Babolat RPM", "", catalog).map((row) => row.id), ["4"]);
});

test("the hint says whether it's in the list, and whether the shop stocks it", () => {
  assert.equal(ownStringHint("Babolat RPM Blast", "4", catalog), "Found it. This shop stocks it too.");
  assert.equal(ownStringHint("Wilson NXT", "5", catalog), "Found it in our string list.");
  assert.equal(ownStringHint("Kirschbaum Max Power", "", catalog), "Not in our list: pick one from the list if it's there, or we'll note it as typed.");
  assert.equal(ownStringHint("", "", catalog), "");
});
