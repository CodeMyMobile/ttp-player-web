import test from "node:test";
import assert from "node:assert/strict";

import { resolveLeagueNextAction } from "./leagueNextAction.ts";

const base = {
  preSeason: false,
  minimumMet: false,
  rankLabel: null as string | null,
};

test("pre-season wins over everything", () => {
  const a = resolveLeagueNextAction({ ...base, preSeason: true });
  assert.equal(a.kind, "preseason");
  assert.equal(a.tone, "ok");
});

test("minimum met → hold, includes rank when known", () => {
  const a = resolveLeagueNextAction({ ...base, minimumMet: true, rankLabel: "1st" });
  assert.equal(a.kind, "hold");
  assert.equal(a.tone, "ok");
  assert.match(a.text, /hold 1st/);
});

test("in-season, minimum not met → play-more CTA (never mentions 'looking')", () => {
  const a = resolveLeagueNextAction({ ...base });
  assert.equal(a.kind, "playmore");
  assert.doesNotMatch(a.text, /looking/i);
  assert.equal(a.cta, "Find a match →");
});
