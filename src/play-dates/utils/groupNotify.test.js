import assert from "node:assert/strict";
import test from "node:test";

import {
  describeGroupNotifyError,
  describeGroupNotifyResult,
  groupNotifyCaption,
} from "./groupNotify.js";

test("describeGroupNotifyResult reads the series endpoint's counts", () => {
  assert.deepEqual(
    describeGroupNotifyResult({ players_notified: 4, sms_sent: 3, sms_skipped_missing_phone: 1, sms_failed: 0 }),
    { ok: true, text: "Texted 3 players · 1 without a mobile number" },
  );
});

test("describeGroupNotifyResult reads the single-match endpoint's counts", () => {
  assert.deepEqual(
    describeGroupNotifyResult({ sent: 1, sms_sent: 1, sms_failed: 0, sms_skipped_missing_phone: 0 }),
    { ok: true, text: "Texted 1 player" },
  );
  assert.deepEqual(
    describeGroupNotifyResult({ sent: 2, sms_sent: 0, sms_failed: 2 }),
    { ok: false, text: "Texted 0 players · 2 texts failed" },
  );
});

test("describeGroupNotifyResult says when nobody new was told", () => {
  assert.equal(describeGroupNotifyResult({ message: "Players were already notified.", sent: 0 }).text, "Everyone in those groups has already been told.");
  assert.equal(describeGroupNotifyResult({ players_notified: 0 }).ok, true);
});

test("describeGroupNotifyError explains the API's refusals", () => {
  assert.equal(describeGroupNotifyError(new Error("No players to notify")), "Everyone in those groups is already in these matches.");
  assert.equal(describeGroupNotifyError({ data: { error: "no_players_to_notify" } }), "Everyone in those groups is already in these matches.");
  assert.equal(describeGroupNotifyError({ data: { error: "notification_limit_reached" } }), "These matches have reached their limit of 30 texts.");
  assert.equal(describeGroupNotifyError(new Error("boom")), "Couldn't send the texts. Try again.");
});

test("groupNotifyCaption", () => {
  assert.equal(groupNotifyCaption(1), "Each player gets a text with a link to this match.");
  assert.equal(groupNotifyCaption(3), "Each player gets one text listing these 3 matches.");
});
