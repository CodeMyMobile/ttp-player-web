import assert from "node:assert/strict";
import test from "node:test";

import { getLeagueMatchNeeds } from "./leagues";

test("getLeagueMatchNeeds sends scope=all query", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ league: { id: 10, name: "Flex" }, needs: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await getLeagueMatchNeeds({ leagueId: 10, token: "abc", scope: "all" });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\/10\/match-needs\?scope=all$/);
});
