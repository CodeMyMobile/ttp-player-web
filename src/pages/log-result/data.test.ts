import test from "node:test";
import assert from "node:assert/strict";

import { resolveLeagueOpponent } from "./data.ts";

const fixture = {
  player1Id: "111",
  player2Id: "222",
  player1Name: "Alex Prior",
  player2Name: "Sam Lee",
};

test("resolveLeagueOpponent — me is player1 by id → opponent is player2", () => {
  const opponent = resolveLeagueOpponent(fixture, { id: "111", name: "Alex Prior" });
  assert.equal(opponent.id, "222");
  assert.equal(opponent.name, "Sam Lee");
});

test("resolveLeagueOpponent — me is player2 by id → opponent is player1", () => {
  const opponent = resolveLeagueOpponent(fixture, { id: "222", name: "Sam Lee" });
  assert.equal(opponent.id, "111");
  assert.equal(opponent.name, "Alex Prior");
});

// The reported bug: the current-user id can't be resolved and falls back to a mock that
// matches neither fixture player. The name fallback still identifies the submitter, so the
// opponent is the *other* player — never the submitter themselves.
test("resolveLeagueOpponent — unresolvable id, name matches player1 → opponent is player2 (not self)", () => {
  const opponent = resolveLeagueOpponent(fixture, { id: "mock-current-user", name: "Alex Prior" });
  assert.equal(opponent.id, "222");
  assert.equal(opponent.name, "Sam Lee");
});

test("resolveLeagueOpponent — unresolvable id, name matches player2 (case-insensitive) → opponent is player1", () => {
  const opponent = resolveLeagueOpponent(fixture, { id: "mock-current-user", name: "sam lee" });
  assert.equal(opponent.id, "111");
  assert.equal(opponent.name, "Alex Prior");
});

// With no resolvable identity at all we can't tell who's who; the guarantee is only that a
// positively-identified "me" is never returned. Fall back to player2 (not the old always-player1).
test("resolveLeagueOpponent — no resolvable identity falls back to player2", () => {
  const opponent = resolveLeagueOpponent(fixture, { id: "", name: "" });
  assert.equal(opponent.id, "222");
});
