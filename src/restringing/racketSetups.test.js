import assert from "node:assert/strict";
import { test } from "node:test";

import {
  racketSetupsComplete,
  racketSetupsItems,
  racketSetupsStringLabel,
  sameSetupForAll,
  withRacketDetails,
  withRacketSetup,
} from "./racketSetups.js";

const poly = {
  input: { serviceTierId: 5, selectedStringId: "15", gauge: "17", tensionMains: 50, tensionCrosses: 50, adviceRequested: false },
  stringLabel: "Babolat RPM Blast",
  label: "Babolat RPM Blast 17 · 50 lbs",
};
const own = {
  input: { serviceTierId: 1, selectedStringId: "43", ownStringText: "Luxilon ALU Power Rough", gauge: "16L", tensionMains: 48, tensionCrosses: 46 },
  stringLabel: "Luxilon ALU Power Rough",
  label: "Your own: Luxilon ALU Power Rough · 48/46 lbs",
};

test("same string on all: every racket gets the setup and keeps its own make and model", () => {
  const setups = sameSetupForAll(poly, 3, [{ racketMakeModel: "Wilson Blade", note: "red grip" }]);
  assert.equal(setups.length, 3);
  assert.deepEqual(setups.map((setup) => setup.input.serviceTierId), [5, 5, 5]);
  assert.deepEqual(setups.map((setup) => setup.racketMakeModel), ["Wilson Blade", "", ""]);
  assert.equal(setups[0].note, "red grip");
});

test("different strings: a racket's setup changes, its make and model stay", () => {
  let setups = withRacketSetup([], 0, poly);
  setups = withRacketDetails(setups, 0, { racketMakeModel: "Wilson Blade" });
  setups = withRacketSetup(setups, 1, own);
  setups = withRacketSetup(setups, 0, own);
  assert.equal(setups[0].racketMakeModel, "Wilson Blade");
  assert.equal(setups[0].input.serviceTierId, 1);
  assert.equal(setups[1].racketMakeModel, "");
});

test("complete once every racket has a setup and a make and model", () => {
  const setups = [{ ...poly, racketMakeModel: "Wilson Blade" }, { ...own, racketMakeModel: " " }];
  assert.equal(racketSetupsComplete(setups, 2), false);
  assert.equal(racketSetupsComplete(withRacketDetails(setups, 1, { racketMakeModel: "Yonex Vcore 100" }), 2), true);
  assert.equal(racketSetupsComplete(setups.slice(0, 1), 2), false);
});

test("one order item per racket, each with its own service, string and tension", () => {
  const items = racketSetupsItems([
    { ...poly, racketMakeModel: "Wilson Blade", note: "red grip" },
    { ...own, racketMakeModel: "Yonex Vcore 100", note: "" },
  ], "Logo stencil");
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.service_tier_id), [5, 1]);
  assert.deepEqual(items.map((item) => item.string_id), [15, 43]);
  assert.equal(items[1].own_string_text, "Luxilon ALU Power Rough");
  assert.deepEqual(items.map((item) => [item.tension_lbs_mains, item.tension_lbs_crosses]), [[50, 50], [48, 46]]);
  assert.deepEqual(items.map((item) => item.racket_make_model), ["Wilson Blade", "Yonex Vcore 100"]);
  assert.deepEqual(items.map((item) => item.notes), ["red grip · Logo stencil", "Logo stencil"]);
});

test("the string line names the string only when every racket has it", () => {
  assert.equal(racketSetupsStringLabel([poly, poly]), "Babolat RPM Blast");
  assert.equal(racketSetupsStringLabel([poly, own]), "Strings");
});
