import assert from "node:assert/strict";
import test from "node:test";
import { buildViewerIdentities, matchesViewer } from "../utils/leagueSeason";
import { holdsGroupSpot } from "../api/groupLessons";

/**
 * The week-bookings tile counts group lessons, and the source is
 * /player/upcoming_group_lessons — the list of classes NEAR you, not the ones
 * you booked. The old test asked whether *anyone* on a lesson held a spot:
 *
 *   players.some((p) => holdsGroupSpot(p.status, p.paymentStatus, p.paymentMethod))
 *
 * Reproduced against production on 2026-08-23: three nearby lessons in the next
 * seven days had at least one confirmed participant, and the tile read
 * "3 booked" for a player who had booked none of them.
 */
const viewer = buildViewerIdentities(
  { id: 4021, email: "asatennisapp@gmail.com" },
  { user_id: 4021, full_name: "Asa Tennis" },
);

// Shaped like the real payload: a popular class full of other people.
const someoneElsesLesson = {
  groupPlayers: [
    { playerId: 1290, name: "Szu Lee", status: 1, paymentStatus: 1 },
    { playerId: 1393, name: "Josh Berenbaum", status: 1, paymentStatus: 1 },
  ],
};

const yourLesson = {
  groupPlayers: [
    { playerId: 1290, name: "Szu Lee", status: 1, paymentStatus: 1 },
    { playerId: 4021, name: "Asa Tennis", status: 1, paymentStatus: 1 },
  ],
};

const holdsOwnSpot = (lesson) =>
  (lesson.groupPlayers || []).some((p) =>
    matchesViewer(viewer, p.playerId, p.participantId, p.email, p.name) &&
    holdsGroupSpot(p.status, p.paymentStatus, p.paymentMethod));

const anyoneHoldsSpot = (lesson) =>
  (lesson.groupPlayers || []).some((p) => holdsGroupSpot(p.status, p.paymentStatus, p.paymentMethod));

test("the old test counted other people's bookings as yours", () => {
  assert.equal(anyoneHoldsSpot(someoneElsesLesson), true, "this is the bug");
});

test("a lesson you have not booked is not one of your bookings", () => {
  assert.equal(holdsOwnSpot(someoneElsesLesson), false);
});

test("a lesson you have booked still counts", () => {
  assert.equal(holdsOwnSpot(yourLesson), true);
});

test("your row must also be a confirmed spot, not merely present", () => {
  const pending = { groupPlayers: [{ playerId: 4021, status: 0, paymentStatus: 0 }] };
  const cancelled = { groupPlayers: [{ playerId: 4021, status: 2, paymentStatus: 2 }] };
  const payOnCourt = { groupPlayers: [{ playerId: 4021, status: 1, paymentStatus: 0, paymentMethod: "pay_on_court" }] };

  assert.equal(holdsOwnSpot(pending), false);
  assert.equal(holdsOwnSpot(cancelled), false);
  assert.equal(holdsOwnSpot(payOnCourt), true, "pay-on-court is a held spot");
});

test("identity matches on email or name when the ids disagree", () => {
  // A participant's player_id and the account user id are not always the same
  // number — the same reason the ladder matches on more than the id.
  const byEmail = { groupPlayers: [{ playerId: 99999, email: "asatennisapp@gmail.com", status: 1, paymentStatus: 1 }] };
  const byName = { groupPlayers: [{ playerId: 99999, name: "Asa Tennis", status: 1, paymentStatus: 1 }] };

  assert.equal(holdsOwnSpot(byEmail), true);
  assert.equal(holdsOwnSpot(byName), true);
});

test("no participants, or a malformed lesson, is not a booking", () => {
  assert.equal(holdsOwnSpot({ groupPlayers: [] }), false);
  assert.equal(holdsOwnSpot({}), false);
});
