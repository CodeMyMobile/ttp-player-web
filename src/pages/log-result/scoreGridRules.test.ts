import test from "node:test";
import assert from "node:assert/strict";

import { computeResult } from "./scoring";
import type { MatchSet, SetKind } from "./scoring";
import { activeChip, cleanCell, setFromCells, thirdSetOpen, winnerLine } from "./scoreGridRules";

const set = (you: number, opp: number, kind: SetKind = "set"): MatchSet => ({ kind, you, opp, tb: null });
const empty = (kind: SetKind = "set") => set(0, 0, kind);

const line = (sets: MatchSet[], dnf = false, dnfWinner: "you" | "opp" | null = null) =>
  winnerLine({ result: computeResult({ sets, dnf, dnfWinner, format: "bo3" }), sets, dnf, opponentName: "Alex" });

test("the winner line reads the score from the winner's side", () => {
  assert.equal(line([set(6, 4), set(3, 6), set(10, 7, "mtb")]), "You won 6–4, 3–6, 10–7");
  assert.equal(line([set(4, 6), set(2, 6), empty()]), "Alex won 6–4, 6–2");
  assert.equal(line([set(6, 4), set(6, 7), set(4, 6)]), "Alex won 4–6, 7–6, 6–4");
});

test("no winner line until the match is decided", () => {
  assert.equal(line([set(6, 4), empty(), empty()]), null);
  assert.equal(line([set(6, 4), set(3, 6), empty("mtb")]), null);
  assert.equal(line([set(6, 6), set(6, 3), empty()]), null);
});

test("retired or default names the winner without a score", () => {
  assert.equal(line([empty(), empty(), empty()], true, "opp"), "Alex won by retirement or default");
  assert.equal(line([empty(), empty(), empty()], true, null), null);
});

test("the third column opens only at one set all", () => {
  assert.equal(thirdSetOpen([set(6, 4), set(3, 6), empty()], "bo3"), true);
  assert.equal(thirdSetOpen([set(6, 4), set(6, 3), empty()], "bo3"), false);
  assert.equal(thirdSetOpen([set(6, 4), empty(), empty()], "bo3"), false);
  assert.equal(thirdSetOpen([set(6, 4)], "single"), false);
});

test("a set counts only once both cells are filled", () => {
  assert.deepEqual(setFromCells("set", "6", ""), empty());
  assert.deepEqual(setFromCells("set", "6", "0"), set(6, 0));
  assert.deepEqual(setFromCells("mtb", "10", "8"), set(10, 8, "mtb"));
});

test("cells take digits only, one for games and two for tiebreak points", () => {
  assert.equal(cleanCell("6a", "set"), "6");
  assert.equal(cleanCell("67", "set"), "6");
  assert.equal(cleanCell("12", "mtb"), "12");
  assert.equal(cleanCell("123", "mtb"), "12");
});

test("the chip follows the deciding set and retirement", () => {
  assert.equal(activeChip([empty(), empty(), empty("mtb")], false), "mtb");
  assert.equal(activeChip([empty(), empty(), empty()], false), "set");
  assert.equal(activeChip([empty(), empty(), empty("mtb")], true), "retired");
});
