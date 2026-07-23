import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfferedSlotOptions,
  buildSlotOptionPayloadFields,
  isUnresolvedSinglesSlotMatch,
} from "./matchSlotOptions.js";

test("singles options payload keeps preferred scalar and sends alternatives only", () => {
  const payload = buildSlotOptionPayloadFields({
    playerLimit: 1,
    preferredTime: "2026-08-01T18:00:00.000Z",
    preferredLocation: {
      location_text: "Penmar Recreation Center",
      latitude: 33.99,
      longitude: -118.46,
    },
    timeOptions: ["2026-08-02T18:00:00.000Z", "2026-08-01T18:00:00.000Z"],
    locationOptions: [
      { location_text: "Ocean View Courts", latitude: "34.01", longitude: "-118.48" },
      { location_text: "Penmar Recreation Center", latitude: 33.99, longitude: -118.46 },
    ],
  });

  assert.deepEqual(payload, {
    time_options: ["2026-08-02T18:00:00.000Z"],
    location_options: [
      { location_text: "Ocean View Courts", latitude: 34.01, longitude: -118.48 },
    ],
  });
});

test("doubles payload never sends selectable slot options", () => {
  assert.deepEqual(
    buildSlotOptionPayloadFields({
      playerLimit: 4,
      preferredTime: "2026-08-01T18:00:00.000Z",
      preferredLocation: { location_text: "Penmar" },
      timeOptions: ["2026-08-02T18:00:00.000Z"],
      locationOptions: [{ location_text: "Ocean View" }],
    }),
    {},
  );
});

test("offered slots combine preferred values with alternatives for respondent pick", () => {
  const options = buildOfferedSlotOptions({
    start_date_time: "2026-08-01T18:00:00.000Z",
    location_text: "Penmar",
    latitude: "33.99",
    longitude: "-118.46",
    time_options: ["2026-08-02T18:00:00.000Z"],
    location_options: [{ location_text: "Ocean View", latitude: 34.01, longitude: -118.48 }],
  });

  assert.deepEqual(options.times.map((item) => item.value), [
    "2026-08-01T18:00:00.000Z",
    "2026-08-02T18:00:00.000Z",
  ]);
  assert.deepEqual(options.locations.map((item) => item.value.location_text), [
    "Penmar",
    "Ocean View",
  ]);
});

test("unresolved singles slot match uses authoritative raw fields", () => {
  assert.equal(isUnresolvedSinglesSlotMatch({ player_limit: 1, slot_resolved: false }), true);
  assert.equal(isUnresolvedSinglesSlotMatch({ player_limit: 4, slot_resolved: false }), false);
  assert.equal(isUnresolvedSinglesSlotMatch({ player_limit: 1, slot_resolved: true }), false);
});
