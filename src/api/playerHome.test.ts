import assert from "node:assert/strict";
import test from "node:test";

import { getPlayerFutureLessons } from "./playerHome";

const mockJsonResponse = (payload: unknown = {}, status = 200, ok = true) =>
  ({
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    json: async () => payload,
  }) as Response;

test("getPlayerFutureLessons treats missing upcoming lessons as an empty list", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    mockJsonResponse({ detail: "Lessons not found" }, 404, false)) as typeof fetch;

  try {
    const response = await getPlayerFutureLessons({ token: "token-123", perPage: 25, page: 1 });

    assert.deepEqual(response.data, []);
    assert.deepEqual(response.lessons, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
