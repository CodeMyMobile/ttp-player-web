import assert from "node:assert/strict";
import test from "node:test";

import { requiresLeagueAuthPrompt } from "./leagueAuthGate";

test("league interactions require auth prompt only for signed-out users", () => {
  assert.equal(requiresLeagueAuthPrompt(false), true);
  assert.equal(requiresLeagueAuthPrompt(true), false);
});
