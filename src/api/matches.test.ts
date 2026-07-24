import assert from "node:assert/strict";
import test from "node:test";

import { createMatch, normalizeMatchRecord } from "./matches";

test("normalizeMatchRecord exposes authoritative slot fields", () => {
  const normalized = normalizeMatchRecord({
    id: 7,
    status: "open",
    player_limit: 1,
    start_date_time: "2026-08-01T18:00:00.000Z",
    location_text: "Penmar",
    time_options: ["2026-08-02T18:00:00.000Z"],
    location_options: [{ location_text: "Ocean View", latitude: "34.01", longitude: "-118.48" }],
    slot_resolved: false,
    slot_resolved_at: null,
    slot_resolved_by: null,
  });

  assert.equal(normalized.status, "open");
  assert.equal(normalized.playerLimit, 1);
  assert.deepEqual(normalized.timeOptions, ["2026-08-02T18:00:00.000Z"]);
  assert.deepEqual(normalized.locationOptions, [
    { location_text: "Ocean View", latitude: 34.01, longitude: -118.48 },
  ]);
  assert.equal(normalized.slotResolved, false);
});

test("createMatch sends slot option arrays for singles option events", async () => {
  const previousFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({ id: 77 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await createMatch({
      privacy: "open",
      startDateTime: "2026-08-01T18:00:00.000Z",
      locationText: "Penmar",
      rosterSize: 1,
      matchFormat: "Singles",
      timeOptions: ["2026-08-02T18:00:00.000Z"],
      locationOptions: [{ location_text: "Ocean View", latitude: 34.01, longitude: -118.48 }],
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(requestBody?.time_options, ["2026-08-02T18:00:00.000Z"]);
  assert.deepEqual(requestBody?.location_options, [
    { location_text: "Ocean View", latitude: 34.01, longitude: -118.48 },
  ]);
});
