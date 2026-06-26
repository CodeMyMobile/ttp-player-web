import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlayedWithHostSet,
  formatPlayedWithCount,
  hasPlayedWithHost,
  normalizePlayedWithResponse,
} from "./playedWith";

test("normalizes played-with response and keeps numeric ids", () => {
  const response = normalizePlayedWithResponse({
    playedWith: [
      {
        userId: "42",
        playerId: "42",
        name: "Rachel L.",
        avatarUrl: "https://cdn.example.com/rachel.jpg",
        ntrp: "3.5",
        matchCount: "3",
      },
      { player_id: 77, full_name: "Manveer K.", profile_picture: "", usta_rating: null, totalMatches: 1 },
    ],
    total: "2",
    lastUpdated: "2026-06-22T14:30:00Z",
  });

  assert.equal(response.total, 2);
  assert.equal(response.playedWith[0].userId, 42);
  assert.equal(response.playedWith[0].playerId, 42);
  assert.equal(response.playedWith[0].ntrp, 3.5);
  assert.equal(response.playedWith[0].matchCount, 3);
  assert.equal(response.playedWith[1].name, "Manveer K.");
  assert.equal(response.playedWith[1].avatarUrl, null);
});

test("detects match hosts in played-with list", () => {
  const playedWith = buildPlayedWithHostSet([
    { userId: 42, playerId: 42, name: "Rachel L.", avatarUrl: null, ntrp: 3.5, matchCount: 3, totalMatches: 3 },
  ]);

  assert.equal(hasPlayedWithHost({ host_id: "42" }, playedWith), true);
  assert.equal(hasPlayedWithHost({ host_id: "99" }, playedWith), false);
});

test("formats shared match counts", () => {
  assert.equal(formatPlayedWithCount(1), "1 match");
  assert.equal(formatPlayedWithCount(3), "3 matches");
});
