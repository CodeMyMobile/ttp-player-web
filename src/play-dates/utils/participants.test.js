import assert from "node:assert/strict";
import test from "node:test";

import {
  uniqueAcceptedInvitees,
  uniqueMatchOccupants,
} from "./participants.js";

test("accepted generic invite without player identity is not a roster occupant", () => {
  const invitees = [
    {
      id: 142,
      invitee_id: null,
      player_id: null,
      status: "accepted",
      profile: null,
      joined: false,
    },
  ];

  assert.deepEqual(uniqueAcceptedInvitees(invitees), []);
});

test("accepted invite with player identity remains a roster occupant", () => {
  const invite = {
    id: 39,
    invitee_id: 10,
    status: "accepted",
    profile: {
      user_id: 10,
      full_name: "Charlotte Cochrane",
    },
  };

  assert.deepEqual(uniqueAcceptedInvitees([invite]), [invite]);
});

test("generic accepted invites do not inflate match occupant count", () => {
  const participants = [
    {
      id: 38,
      player_id: 6,
      status: "hosting",
      profile: { user_id: 6, full_name: "Paul Cochrane" },
    },
    {
      id: 39,
      player_id: 10,
      status: "confirmed",
      profile: { user_id: 10, full_name: "Charlotte Cochrane" },
    },
  ];
  const invitees = [
    {
      id: 142,
      invitee_id: null,
      status: "accepted",
      profile: null,
      joined: false,
    },
  ];

  assert.equal(uniqueMatchOccupants(participants, invitees).length, 2);
});
