import test from "node:test";
import assert from "node:assert/strict";

import { searchCircle } from "./circle";

test("searchCircle asks the circle search with the query", async () => {
  const previousFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    assert.deepEqual(await searchCircle("sam riv"), { results: [] });
  } finally {
    globalThis.fetch = previousFetch;
  }
  const url = new URL(requested);
  assert.match(url.pathname, /\/player\/circle\/search$/);
  assert.equal(url.searchParams.get("q"), "sam riv");
});
