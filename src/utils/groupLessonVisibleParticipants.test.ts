import assert from "node:assert/strict";
import test from "node:test";

import { buildVisibleGroupLessonParticipantRows } from "./groupLessonVisibleParticipants";

test("buildVisibleGroupLessonParticipantRows includes non-cancelled reserved seats", () => {
  const rows = buildVisibleGroupLessonParticipantRows({
    participants: [
      {
        id: "confirmed",
        name: "Confirmed Player",
        status: 1,
        paymentStatus: 1,
        paymentMethod: "stripe",
      },
      {
        id: "pending",
        name: "Pending Player",
        status: 0,
        paymentStatus: 0,
      },
      {
        id: "pay-on-court",
        name: "Pay On Court Player",
        status: 1,
        paymentStatus: 0,
        paymentMethod: "pay_on_court",
      },
      {
        id: "cancelled",
        name: "Cancelled Player",
        status: 2,
        paymentStatus: 2,
      },
    ],
  });

  assert.deepEqual(rows.map((row) => row.name), [
    "Confirmed Player",
    "Pending Player",
    "Pay On Court Player",
  ]);
});
