import assert from "node:assert/strict";
import test from "node:test";

import { buildCompletedSignupSession } from "./AuthDrawerSession.js";

test("buildCompletedSignupSession stores completed phone profile in session", () => {
  const session = {
    access_token: "token",
    email: "player@example.com",
    profile: {
      id: 111,
      email: "player@example.com",
      phone: null,
    },
  };
  const updatedProfile = {
    id: 245,
    phone: "13105550123",
    full_name: "Sahil Kashyap",
  };

  const nextSession = buildCompletedSignupSession({
    session,
    updatedProfile,
    phone: "13105550123",
    fullName: "Sahil Kashyap",
  });

  assert.equal(nextSession.phone, "13105550123");
  assert.equal(nextSession.full_name, "Sahil Kashyap");
  assert.equal(nextSession.profile.phone, "13105550123");
  assert.equal(nextSession.profile.full_name, "Sahil Kashyap");
  assert.equal(nextSession.profile.id, 245);
  assert.equal(nextSession.access_token, "token");
});
