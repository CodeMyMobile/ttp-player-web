import assert from "node:assert/strict";
import test from "node:test";

import { recordCoachMessageTap } from "./playerCoaches";

const mockJsonResponse = (payload: unknown = {}, status = 200, ok = true) =>
  ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => payload,
  }) as Response;

test("recordCoachMessageTap posts a message_tap for the coach", async () => {
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return mockJsonResponse({ recorded: true }, 201);
  }) as typeof fetch;

  try {
    await recordCoachMessageTap({ token: "token-123", coachId: 42 });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/player\/coaches\/42\/contact-events$/);
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { kind: "message_tap", source: "web" });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("recordCoachMessageTap never throws, so a failure can't block the Message link", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => mockJsonResponse({ detail: "boom" }, 500, false)) as typeof fetch;
  try {
    assert.equal(await recordCoachMessageTap({ token: "token-123", coachId: 42 }), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
