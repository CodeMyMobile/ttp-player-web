import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setStatus,
  computeResult,
  fmtSet,
  scoreString,
  isTiebreakSet,
  localISO,
  prettyDate,
  buildSubmitPayload,
  newSet,
  TODAY,
  YESTERDAY,
  type MatchSet,
} from "./scoring.ts";

const set = (you: number, opp: number, kind: "set" | "mtb" = "set", tb: MatchSet["tb"] = null): MatchSet =>
  ({ kind, you, opp, tb });

test("setStatus — full sets", () => {
  assert.equal(setStatus(set(0, 0)), "empty");
  assert.equal(setStatus(set(6, 4)), "ok");
  assert.equal(setStatus(set(4, 6)), "ok");
  assert.equal(setStatus(set(7, 5)), "ok");
  assert.equal(setStatus(set(7, 6)), "ok");
  assert.equal(setStatus(set(6, 5)), "invalid"); // not won yet
  assert.equal(setStatus(set(6, 6)), "invalid"); // tie
  assert.equal(setStatus(set(8, 6)), "invalid"); // can't go past 7
});

test("setStatus — match tiebreak (first to 10, win by 2)", () => {
  assert.equal(setStatus(set(10, 7, "mtb")), "ok");
  assert.equal(setStatus(set(12, 10, "mtb")), "ok");
  assert.equal(setStatus(set(10, 9, "mtb")), "invalid"); // only 1 ahead
  assert.equal(setStatus(set(9, 7, "mtb")), "invalid"); // under 10
});

test("isTiebreakSet — only 7-6 / 6-7 full sets", () => {
  assert.equal(isTiebreakSet(set(7, 6)), true);
  assert.equal(isTiebreakSet(set(6, 7)), true);
  assert.equal(isTiebreakSet(set(6, 4)), false);
  assert.equal(isTiebreakSet(set(10, 7, "mtb")), false);
});

test("computeResult — single set", () => {
  const win = computeResult({ sets: [set(6, 4)], dnf: false, dnfWinner: null, format: "single" });
  assert.equal(win.complete, true);
  assert.equal(win.winner, "you");

  const empty = computeResult({ sets: [set(0, 0)], dnf: false, dnfWinner: null, format: "single" });
  assert.equal(empty.complete, false);
  assert.equal(empty.issue, "Enter the games.");

  const invalid = computeResult({ sets: [set(4, 3)], dnf: false, dnfWinner: null, format: "single" });
  assert.equal(invalid.complete, false);
  assert.equal(invalid.issue, "Check the set scores — e.g. 6-4, 7-5 or 7-6.");
});

test("computeResult — best of 3 with mtb decider", () => {
  const r = computeResult({
    sets: [set(6, 4), set(3, 6), set(10, 7, "mtb")],
    dnf: false, dnfWinner: null, format: "bo3",
  });
  assert.equal(r.complete, true);
  assert.equal(r.winner, "you");
  assert.equal(r.you, 2);
  assert.equal(r.opp, 1);
  assert.equal(r.decider, "mtb");
});

test("computeResult — invalid set flagged", () => {
  const r = computeResult({ sets: [set(6, 6)], dnf: false, dnfWinner: null, format: "single" });
  assert.equal(r.complete, false);
  assert.equal(r.issue, "Check the set scores — e.g. 6-4, 7-5 or 7-6.");
});

test("computeResult — retirement needs a winner", () => {
  const empty = computeResult({ sets: [], dnf: true, dnfWinner: null, format: "bo3" });
  assert.equal(empty.complete, false);
  assert.equal(empty.issue, "Pick who won.");

  const picked = computeResult({ sets: [], dnf: true, dnfWinner: "opp", format: "bo3" });
  assert.equal(picked.complete, true);
  assert.equal(picked.winner, "opp");
});

test("fmtSet / scoreString", () => {
  assert.equal(fmtSet(set(6, 4)), "6-4");
  assert.equal(fmtSet(set(10, 7, "mtb")), "[10-7]");
  assert.equal(fmtSet(set(7, 6, "set", { you: 7, opp: 5 })), "7-6(5)");
  assert.equal(
    scoreString([set(6, 4), set(3, 6), set(10, 7, "mtb")], false),
    "6-4  3-6  [10-7]",
  );
  assert.equal(scoreString([set(6, 4)], true), "Retired");
});

test("localISO / prettyDate", () => {
  assert.match(localISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(prettyDate(TODAY), "Today");
  assert.equal(prettyDate(YESTERDAY), "Yesterday");
});

const me = { id: "me", name: "Paul", ntrp: "4.5" };
const opp = { id: "p1", name: "Marcus Webb", ntrp: "4.0" };
const court = { id: "c1", name: "Penmar", area: "Venice" };

test("buildSubmitPayload — sets path (you first, mtb decider)", () => {
  const payload = buildSubmitPayload({
    me, opponent: opp, date: "2026-06-20", court,
    format: "bo3", dnf: false, dnfWinner: null,
    sets: [set(6, 4), set(3, 6), set(10, 7, "mtb")],
  });
  assert.deepEqual(payload, {
    context: "recreational",
    reported_by: "me",
    player_b: "p1",
    played_at: "2026-06-20",
    venue_id: "c1",
    format: "bo3",
    retired: false,
    sets: [
      { kind: "set", you: 6, opp: 4 },
      { kind: "set", you: 3, opp: 6 },
      { kind: "mtb", you: 10, opp: 7 },
    ],
    score_string: "6-4  3-6  [10-7]",
  });
});

test("buildSubmitPayload — retired path", () => {
  const payload = buildSubmitPayload({
    me, opponent: opp, date: "2026-06-20", court,
    format: "bo3", dnf: true, dnfWinner: "you", sets: [],
  });
  assert.deepEqual(payload, {
    context: "recreational",
    reported_by: "me",
    player_b: "p1",
    played_at: "2026-06-20",
    venue_id: "c1",
    format: "bo3",
    retired: { winner: "you" },
    score_string: "Retired",
  });
});

test("newSet — fresh empty set", () => {
  assert.deepEqual(newSet(), { kind: "set", you: 0, opp: 0, tb: null });
});
