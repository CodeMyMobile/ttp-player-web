import assert from "node:assert/strict";
import test from "node:test";

import { mapUpcomingGroupLesson } from "./groupLessons";

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
