import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest } from "./apiRequest";

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

test("apiRequest refreshes with the API's GET authorization contract before retrying", async () => {
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  storage.clear();
  storage.set("authToken", "expired-access-token");
  storage.set("refreshToken", "refresh-token");

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.localStorage = localStorageMock as Storage;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });

    if (requests.length === 1) {
      return new Response(null, { status: 401 });
    }
    if (requests.length === 2) {
      return new Response(JSON.stringify({ access_token: "renewed-access-token", refresh_token: "renewed-refresh-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const response = await apiRequest("/player/coaches");

    assert.equal(response.status, 200);
    assert.equal(requests[1]?.url.endsWith("/auth/refresh-token"), true);
    assert.equal(requests[1]?.init?.method, "GET");
    assert.equal(new Headers(requests[1]?.init?.headers).get("Authorization"), "Token refresh-token");
    assert.equal(new Headers(requests[2]?.init?.headers).get("Authorization"), "Token renewed-access-token");
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
  }
});
