import assert from "node:assert/strict";
import test from "node:test";

import {
  experienceLabel,
  lessonRequestErrorCode,
  lessonRequestErrorMessage,
  readCoachConnection,
  timeOfDayLabel,
} from "./coachLessonRequests";

test("reads where the player stands with a coach, and nothing from an API that doesn't say", () => {
  assert.equal(readCoachConnection({ connection: { status: "connected" } }), "connected");
  assert.equal(readCoachConnection({ connection: { status: "requested" } }), "requested");
  assert.equal(readCoachConnection({ connection: { status: "none" } }), "none");
  // Older API: no connection field, so "Message coach" keeps working as before.
  assert.equal(readCoachConnection({ contact: { phone: "3105550100" } }), null);
  assert.equal(readCoachConnection({ connection: { status: "friends" } }), null);
  assert.equal(readCoachConnection(null), null);
});

test("reads the API's error code and explains each refusal", () => {
  assert.equal(lessonRequestErrorCode({ data: { error: "player_phone_required" } }), "player_phone_required");
  assert.equal(lessonRequestErrorCode(new Error("network")), undefined);
  assert.match(lessonRequestErrorMessage("player_phone_required", "Paul"), /Add a mobile number .* Paul's reply/);
  assert.match(lessonRequestErrorMessage("lesson_request_declined", "Paul"), /Paul isn't taking new players/);
  assert.equal(lessonRequestErrorMessage("something_new", "Paul"), "Something went wrong. Please try again.");
});

test("labels the API's answer keys, and passes an unknown key through", () => {
  assert.equal(experienceLabel("new"), "New to tennis");
  assert.equal(timeOfDayLabel("weekends"), "Weekends");
  assert.equal(timeOfDayLabel("midnight"), "midnight");
});
