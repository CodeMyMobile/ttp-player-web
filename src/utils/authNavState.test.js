import assert from "node:assert/strict";
import { test } from "node:test";

import { getAuthNavState } from "./authNavState.js";

test("logged-out nav ignores stale player identity", () => {
  assert.deepEqual(
    getAuthNavState({
      isAuthenticated: false,
      displayName: "Paul Cochrane",
      initials: "PC",
      avatarUrl: "https://example.com/avatar.jpg",
    }),
    {
      isAuthenticated: false,
      displayName: "Player",
      initials: "PL",
      avatarUrl: null,
    },
  );
});

test("logged-in nav keeps player identity", () => {
  assert.deepEqual(
    getAuthNavState({
      isAuthenticated: true,
      displayName: "Paul Cochrane",
      initials: "PC",
      avatarUrl: "https://example.com/avatar.jpg",
    }),
    {
      isAuthenticated: true,
      displayName: "Paul Cochrane",
      initials: "PC",
      avatarUrl: "https://example.com/avatar.jpg",
    },
  );
});
