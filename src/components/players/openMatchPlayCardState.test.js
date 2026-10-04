import assert from "node:assert/strict";
import test from "node:test";

import { isCurrentUserInMatch } from "./openMatchPlayCardState.js";

test("treats invited current user as already in the match", () => {
  const match = {
    host_id: 6,
    participants: [{ player_id: 6, status: "hosting" }],
    invitees: [{ invitee_id: 10, status: "pending" }],
  };

  assert.equal(isCurrentUserInMatch(match, 10, 6), true);
});


import { openMatchSlotChoices, slotJoinChoice } from "./openMatchPlayCardState.js";

const slotMatch = {
  id: 369,
  player_limit: 1,
  slot_resolved: false,
  start_date_time: "2026-10-08T17:00:00.000Z",
  location_text: "Penmar Recreation Center",
  latitude: 34.0,
  longitude: -118.45,
  time_options: ["2026-10-08T19:00:00.000Z", "2026-10-09T17:00:00.000Z"],
};

test("lists every offered time for a match offered at several times", () => {
  const choices = openMatchSlotChoices(slotMatch);
  assert.equal(choices.isSlotMatch, true);
  assert.deepEqual(choices.times.map((time) => time.value), [
    "2026-10-08T17:00:00.000Z",
    "2026-10-08T19:00:00.000Z",
    "2026-10-09T17:00:00.000Z",
  ]);
  assert.equal(choices.locations.length, 1);
});

test("joins with the chosen time and the only place", () => {
  const choices = openMatchSlotChoices(slotMatch);
  assert.deepEqual(slotJoinChoice(choices, 2), {
    chosen_time: "2026-10-09T17:00:00.000Z",
    chosen_location: { location_text: "Penmar Recreation Center", latitude: 34, longitude: -118.45 },
  });
  assert.deepEqual(slotJoinChoice(choices), {
    chosen_time: "2026-10-08T17:00:00.000Z",
    chosen_location: { location_text: "Penmar Recreation Center", latitude: 34, longitude: -118.45 },
  });
});

test("plain and already-resolved matches have no choices", () => {
  const plain = { id: 367, player_limit: 2, start_date_time: "2026-10-05T17:00:00.000Z" };
  assert.deepEqual(openMatchSlotChoices(plain), { isSlotMatch: false, times: [], locations: [] });
  assert.equal(slotJoinChoice(openMatchSlotChoices(plain)), undefined);
  assert.equal(openMatchSlotChoices({ ...slotMatch, slot_resolved: true }).isSlotMatch, false);
});
