import assert from "node:assert/strict";
import test from "node:test";

import { resolveLeagueAuthToken } from "./leagueAuthToken";

test("resolveLeagueAuthToken prefers the stored API token over token-like user fields", () => {
  const token = resolveLeagueAuthToken({
    storedToken: "Token valid-api-jwt",
    user: {
      session: { access_token: "oauth-session-token" },
      access_token: "oauth-access-token",
      token: "profile-token-field",
    },
  });

  assert.equal(token, "Token valid-api-jwt");
});

test("resolveLeagueAuthToken falls back to user fields when no stored token exists", () => {
  assert.equal(
    resolveLeagueAuthToken({
      storedToken: null,
      user: { session: { access_token: "session-token" } },
    }),
    "session-token",
  );
});
