import assert from "node:assert/strict";
import test from "node:test";

import { buildVisibleGroupLessonParticipantRows } from "./groupLessonVisibleParticipants";

test("buildVisibleGroupLessonParticipantRows excludes pending participants", () => {
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
    ],
  });

  assert.deepEqual(rows.map((row) => row.name), [
    "Confirmed Player",
    "Pay On Court Player",
  ]);
});
