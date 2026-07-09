import assert from "node:assert/strict";
import test from "node:test";

import {
  requestLeagueJoin,
  requiresLeagueAuthPrompt,
  resumePendingLeagueJoin,
} from "./leagueAuthGate";

test("league interactions require auth prompt only for signed-out users", () => {
  assert.equal(requiresLeagueAuthPrompt(false), true);
  assert.equal(requiresLeagueAuthPrompt(true), false);
});

test("signed-out join requests open auth and preserve the pending league id", () => {
  const result = requestLeagueJoin({
    isAuthenticated: false,
    leagueId: 42,
  });

  assert.deepEqual(result, {
    action: "open_auth",
    pending: {
      leagueId: 42,
    },
  });
});

test("signed-in join requests open the review sheet directly", () => {
  const result = requestLeagueJoin({
    isAuthenticated: true,
    leagueId: 7,
  });

  assert.deepEqual(result, {
    action: "open_review",
    leagueId: 7,
    pending: null,
  });
});

test("successful auth resumes and consumes one pending league id", () => {
  const resumed = resumePendingLeagueJoin({
    isAuthenticated: true,
    pending: {
      leagueId: "league-12",
    },
  });

  assert.deepEqual(resumed, {
    action: "open_review",
    leagueId: "league-12",
    pending: null,
  });

  const consumed = resumePendingLeagueJoin({
    isAuthenticated: true,
    pending: resumed.pending,
  });

  assert.deepEqual(consumed, {
    action: "idle",
    pending: null,
  });
});
