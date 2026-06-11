import assert from "node:assert/strict";
import test from "node:test";

import { buildCoachInviteItems } from "./dashboardInvites.js";

test("dashboard does not show a group lesson invite when current participant is confirmed", () => {
  const items = buildCoachInviteItems(
    [
      {
        id: 1893,
        coach_id: 26,
        created_by: 26,
        start_date_time: "2026-06-11T09:00:00.000Z",
        lessontype_id: 3,
        group_price_per_person: "40",
        group_players: [
          {
            player_id: 1001,
            email: "tanaz@example.com",
            payment_status: 1,
            status: 1,
          },
          {
            player_id: 6,
            email: "asatennisapp@gmail.com",
            payment_status: 1,
            status: 1,
          },
          {
            player_id: 1057,
            email: "pending@example.com",
            payment_status: 0,
            status: 0,
          },
        ],
      },
    ],
    { id: 6, email: "asatennisapp@gmail.com" },
  );

  assert.deepEqual(items, []);
});

test("dashboard shows a group lesson invite only for the matching pending participant", () => {
  const items = buildCoachInviteItems(
    [
      {
        id: 1893,
        full_name: "Paul Cochrane",
        coach_id: 26,
        created_by: 26,
        start_date_time: "2026-06-11T09:00:00.000Z",
        lessontype_id: 3,
        group_price_per_person: "40",
        group_players: [
          {
            player_id: 6,
            email: "asatennisapp@gmail.com",
            payment_status: 1,
            status: 1,
          },
          {
            player_id: 1057,
            email: "pending@example.com",
            payment_status: 0,
            status: 0,
          },
        ],
      },
    ],
    { id: 1057, email: "pending@example.com" },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].description, "Invited you to a group lesson");
  assert.equal(items[0].destination, "/group-lessons/1893");
});

test("dashboard does not guess a pending group participant when current user identity is missing", () => {
  const items = buildCoachInviteItems(
    [
      {
        id: 1893,
        coach_id: 26,
        created_by: 26,
        lessontype_id: 3,
        group_players: [
          {
            player_id: 1057,
            email: "pending@example.com",
            payment_status: 0,
            status: 0,
          },
        ],
      },
    ],
    null,
  );

  assert.deepEqual(items, []);
});
