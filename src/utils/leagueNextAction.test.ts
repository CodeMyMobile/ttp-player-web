import test from "node:test";
import assert from "node:assert/strict";

import { resolveLeagueNextAction } from "./leagueNextAction.ts";

const base = {
  preSeason: false,
  hasUnloggedScore: false,
  minimumMet: false,
  playersLookingCount: 0,
  rankLabel: null as string | null,
};

test("pre-season wins over everything", () => {
  const a = resolveLeagueNextAction({
    ...base,
    preSeason: true,
    hasUnloggedScore: true,
    playersLookingCount: 5,
  });
  assert.equal(a.kind, "preseason");
  assert.equal(a.tone, "ok");
});

test("unlogged score is top priority when in-season, names the opponent", () => {
  const a = resolveLeagueNextAction({
    ...base,
    hasUnloggedScore: true,
    unloggedOpponentName: "Marc T.",
    playersLookingCount: 4,
  });
  assert.equal(a.kind, "log-score");
  assert.match(a.text, /Marc T\./);
  assert.equal(a.cta, "Log score →");
});

test("unlogged score without a name degrades gracefully", () => {
  const a = resolveLeagueNextAction({ ...base, hasUnloggedScore: true, unloggedOpponentName: "" });
  assert.equal(a.kind, "log-score");
  assert.doesNotMatch(a.text, /undefined|null/);
});

test("minimum not met + players looking → looking", () => {
  const a = resolveLeagueNextAction({ ...base, playersLookingCount: 4 });
  assert.equal(a.kind, "looking");
  assert.match(a.text, /4 looking/);
});

test("minimum not met + nobody looking → none (never invents a looking chip)", () => {
  const a = resolveLeagueNextAction({ ...base, playersLookingCount: 0 });
  assert.equal(a.kind, "none");
});

test("minimum met → hold, includes rank when known", () => {
  const a = resolveLeagueNextAction({ ...base, minimumMet: true, rankLabel: "1st" });
  assert.equal(a.kind, "hold");
  assert.equal(a.tone, "ok");
  assert.match(a.text, /hold 1st/);
});

test("minimum met beats players-looking (already qualified)", () => {
  const a = resolveLeagueNextAction({ ...base, minimumMet: true, playersLookingCount: 9 });
  assert.equal(a.kind, "hold");
});
