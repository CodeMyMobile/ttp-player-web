import assert from "node:assert/strict";
import test from "node:test";

import {
  holdsGroupSpot,
  isComped,
  isPayOnCourt,
  mapUpcomingGroupLesson,
  resolveBookingState,
} from "./groupLessons";

test("isPayOnCourt matches pay_on_court case-insensitively", () => {
  assert.equal(isPayOnCourt("pay_on_court"), true);
  assert.equal(isPayOnCourt("PAY_ON_COURT"), true);
  assert.equal(isPayOnCourt("card"), false);
  assert.equal(isPayOnCourt(null), false);
});

test("isComped matches comped case-insensitively", () => {
  assert.equal(isComped("comped"), true);
  assert.equal(isComped("COMPED"), true);
  assert.equal(isComped("card"), false);
  assert.equal(isComped(null), false);
});

test("resolveBookingState treats paid active bookings as booked", () => {
  assert.deepEqual(resolveBookingState({ status: 1, paymentStatus: 1, paymentMethod: "card" }), {
    key: "booked",
    label: "Booked",
    tone: "success",
    paymentDue: false,
  });
});

test("resolveBookingState treats cancelled status or payment as cancelled", () => {
  assert.deepEqual(resolveBookingState({ status: 2, paymentStatus: 1, paymentMethod: "card" }), {
    key: "cancelled",
    label: "Cancelled",
    tone: "danger",
    paymentDue: false,
  });
  assert.deepEqual(resolveBookingState({ status: 1, paymentStatus: 2, paymentMethod: "card" }), {
    key: "cancelled",
    label: "Cancelled",
    tone: "danger",
    paymentDue: false,
  });
});

test("resolveBookingState treats active pay on court as booked with payment due", () => {
  assert.deepEqual(resolveBookingState({ status: 1, paymentStatus: 0, paymentMethod: "pay_on_court" }), {
    key: "pay_on_court",
    label: "Booked · pay on the day",
    tone: "success",
    paymentDue: true,
  });
});

test("resolveBookingState treats active comped bookings as booked without payment due", () => {
  assert.deepEqual(resolveBookingState({ status: 1, paymentStatus: 0, paymentMethod: "comped" }), {
    key: "comped",
    label: "Booked · added by coach",
    tone: "success",
    paymentDue: false,
  });
});

test("resolveBookingState treats a non-cancelled comped API record as booked", () => {
  assert.deepEqual(resolveBookingState({ status: 0, paymentStatus: 0, paymentMethod: "comped" }), {
    key: "comped",
    label: "Booked · added by coach",
    tone: "success",
    paymentDue: false,
  });
});

test("resolveBookingState leaves active unpaid card bookings pending", () => {
  assert.deepEqual(resolveBookingState({ status: 1, paymentStatus: 0, paymentMethod: "card" }), {
    key: "pending",
    label: "Pending",
    tone: "pending",
    paymentDue: false,
  });
});

test("holdsGroupSpot counts paid and pay-on-court reservations only", () => {
  assert.equal(holdsGroupSpot(1, 1, "card"), true);
  assert.equal(holdsGroupSpot(1, 0, "pay_on_court"), true);
  assert.equal(holdsGroupSpot(1, 0, "card"), false);
  assert.equal(holdsGroupSpot(2, 1, "pay_on_court"), false);
});

test("holdsGroupSpot counts active comped reservations but not cancelled ones", () => {
  assert.equal(holdsGroupSpot(1, 0, "comped"), true);
  assert.equal(holdsGroupSpot(2, 0, "comped"), false);
});

test("holdsGroupSpot counts a non-cancelled comped API record", () => {
  assert.equal(holdsGroupSpot(0, 0, "comped"), true);
});

test("mapUpcomingGroupLesson preserves pending credit status without marking participant booked", () => {
  const lesson = mapUpcomingGroupLesson({
    id: 2558,
    coach_id: 10,
    full_name: "Coach",
    start_date_time: "2026-07-15T14:00:00Z",
    end_date_time: "2026-07-15T15:00:00Z",
    player_limit: 4,
    group_price_per_person: "25",
    metadata: {
      title: "Group lesson",
      duration: 60,
    },
    group_players: [
      {
        id: 99,
        participant_id: 99,
        player_id: 7,
        full_name: "Brianna",
        payment_status: 0,
        status: 0,
        credit_status: "pending",
        credit_purchase_id: 123,
      },
    ],
  });

  assert.equal(lesson.participants.length, 0);
  assert.equal(lesson.groupPlayers?.[0]?.creditStatus, "pending");
  assert.equal(lesson.groupPlayers?.[0]?.creditPurchaseId, 123);
});

test("mapUpcomingGroupLesson counts pay-on-court participants as active", () => {
  const lesson = mapUpcomingGroupLesson({
    id: 2559,
    coach_id: 10,
    full_name: "Coach",
    start_date_time: "2026-07-15T14:00:00Z",
    end_date_time: "2026-07-15T15:00:00Z",
    player_limit: 4,
    group_price_per_person: "25",
    metadata: {
      title: "Group lesson",
      duration: 60,
    },
    group_players: [
      {
        id: 100,
        participant_id: 100,
        player_id: 8,
        full_name: "Alex",
        payment_status: 0,
        status: 1,
        payment_method: "pay_on_court",
      },
    ],
  });

  assert.equal(lesson.participants.length, 1);
  assert.equal(lesson.availableSpots, 3);
  assert.equal(lesson.groupPlayers?.[0]?.paymentMethod, "pay_on_court");
});
