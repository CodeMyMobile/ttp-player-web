import assert from "node:assert/strict";
import test from "node:test";

import {
  findUpcomingLessonForSlot,
  getGroupParticipantBookingState,
} from "./coachProfileBookingState.js";

test("group booking state stays empty when pending participant is another player", () => {
  const state = getGroupParticipantBookingState(
    [
      {
        player_id: 99,
        email: "other@example.com",
        status: 0,
        payment_status: 0,
      },
    ],
    { id: 12, email: "player@example.com" },
  );

  assert.equal(state, null);
});

test("group booking state is pending when logged-in user matches pending participant", () => {
  const state = getGroupParticipantBookingState(
    [
      {
        player_id: 12,
        email: "player@example.com",
        status: 0,
        payment_status: 0,
      },
    ],
    { id: 12, email: "player@example.com" },
  );

  assert.equal(state, "pending");
});

test("group booking state is confirmed only when participant and payment are active", () => {
  const state = getGroupParticipantBookingState(
    [
      {
        player_id: 12,
        status: 1,
        payment_status: 1,
      },
    ],
    { id: 12 },
  );

  assert.equal(state, "confirmed");
});

test("group booking state confirms a non-cancelled comped participant", () => {
  const state = getGroupParticipantBookingState(
    [
      {
        player_id: 12,
        status: 0,
        payment_status: 0,
        payment_method: "comped",
      },
    ],
    { id: 12 },
  );

  assert.equal(state, "confirmed");
});

test("cancelled comped participant remains pending", () => {
  const state = getGroupParticipantBookingState(
    [
      {
        player_id: 12,
        status: 2,
        payment_status: 0,
        payment_method: "comped",
      },
    ],
    { id: 12 },
  );

  assert.equal(state, "pending");
});

test("group slot matching ignores overlapping lessons with a different source lesson id", () => {
  const slot = {
    id: "group-slot",
    type: "group",
    sourceLessonId: 10,
  };

  const match = findUpcomingLessonForSlot({
    slot,
    currentUser: { id: 12 },
    upcomingLessons: [
      {
        id: 11,
        group_players: [{ player_id: 12, status: 0, payment_status: 0 }],
      },
    ],
    getLessonRange: () => ({ start: 0, end: 1 }),
    overlapsRange: () => true,
  });

  assert.equal(match, null);
});
