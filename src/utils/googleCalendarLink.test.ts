import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MATCH_MINUTES, buildGoogleCalendarUrl } from "./googleCalendarLink";

const parse = (url: string | null) => {
  assert.ok(url, "expected a url");
  return new URL(url);
};

test("emits Google's UTC basic-format range", () => {
  const url = parse(
    buildGoogleCalendarUrl({ title: "Match", startDateTime: "2026-09-10T18:00:00.000Z" }),
  );

  assert.equal(url.searchParams.get("dates"), "20260910T180000Z/20260910T193000Z");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
});

test("pads every component to two digits", () => {
  // A single-digit month, day, hour and minute — the case that silently produces an
  // unparseable range if any pad is missed.
  const url = parse(
    buildGoogleCalendarUrl({ title: "Match", startDateTime: "2026-01-02T03:04:05.000Z" }),
  );

  assert.equal(url.searchParams.get("dates"), "20260102T030405Z/20260102T043405Z");
});

test("rolls the end time across midnight and the month boundary", () => {
  const url = parse(
    buildGoogleCalendarUrl({ title: "Match", startDateTime: "2026-01-31T23:30:00.000Z" }),
  );

  assert.equal(url.searchParams.get("dates"), "20260131T233000Z/20260201T010000Z");
});

test("honours an explicit duration", () => {
  const url = parse(
    buildGoogleCalendarUrl({
      title: "Match",
      startDateTime: "2026-09-10T18:00:00.000Z",
      durationMinutes: 60,
    }),
  );

  assert.equal(url.searchParams.get("dates"), "20260910T180000Z/20260910T190000Z");
});

test("defaults to a 90 minute match", () => {
  assert.equal(DEFAULT_MATCH_MINUTES, 90);
});

test("carries title, location and details through", () => {
  const url = parse(
    buildGoogleCalendarUrl({
      title: "League match vs Keiko Shinomoto",
      startDateTime: "2026-09-10T18:00:00.000Z",
      location: "Penmar Recreation Center, Venice",
      details: "Women's Advanced Fall Flex League",
    }),
  );

  assert.equal(url.searchParams.get("text"), "League match vs Keiko Shinomoto");
  assert.equal(url.searchParams.get("location"), "Penmar Recreation Center, Venice");
  assert.equal(url.searchParams.get("details"), "Women's Advanced Fall Flex League");
});

test("omits location and details rather than sending empty values", () => {
  const url = parse(
    buildGoogleCalendarUrl({ title: "Match", startDateTime: "2026-09-10T18:00:00.000Z" }),
  );

  assert.equal(url.searchParams.has("location"), false);
  assert.equal(url.searchParams.has("details"), false);
});

test("returns null when there is no usable start — the caller hides the button", () => {
  assert.equal(buildGoogleCalendarUrl({ title: "Match", startDateTime: null }), null);
  assert.equal(buildGoogleCalendarUrl({ title: "Match", startDateTime: undefined }), null);
  assert.equal(buildGoogleCalendarUrl({ title: "Match", startDateTime: "not a date" }), null);
});
