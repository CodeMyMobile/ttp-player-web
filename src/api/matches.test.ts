import assert from "node:assert/strict";
import test from "node:test";

import { createMatch, listMatches, normalizeMatchRecord } from "./matches";

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
      rosterSize: 2,
      matchFormat: "Singles",
      timeOptions: ["2026-08-02T18:00:00.000Z"],
      locationOptions: [{ location_text: "Ocean View", latitude: 34.01, longitude: -118.48 }],
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requestBody?.player_limit, 2);
  assert.deepEqual(requestBody?.time_options, ["2026-08-02T18:00:00.000Z"]);
  assert.deepEqual(requestBody?.location_options, [
    { location_text: "Ocean View", latitude: 34.01, longitude: -118.48 },
  ]);
});

test("listMatches sends the week's range, the level, and skips the counts", async () => {
  const previousFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await listMatches({
      filter: "open",
      from: "2026-11-06T08:00:00.000Z",
      to: "2026-11-13T08:00:00.000Z",
      level: 3.5,
      counts: false,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  const query = new URL(requested).searchParams;
  assert.equal(query.get("filter"), "open");
  assert.equal(query.get("from"), "2026-11-06T08:00:00.000Z");
  assert.equal(query.get("to"), "2026-11-13T08:00:00.000Z");
  assert.equal(query.get("level"), "3.5");
  assert.equal(query.get("counts"), "0");
});
