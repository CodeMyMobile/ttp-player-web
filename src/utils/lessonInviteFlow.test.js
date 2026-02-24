import test from "node:test";
import assert from "node:assert/strict";

import { decideInviteNextAction, extractInviteTokenFromRoute } from "./lessonInviteFlow.js";

test("extractInviteTokenFromRoute reads token from params", () => {
  const token = extractInviteTokenFromRoute({ paramsToken: "abc123" });
  assert.equal(token, "abc123");
});

test("extractInviteTokenFromRoute reads token from hash route", () => {
  const token = extractInviteTokenFromRoute({ hash: "#/li/hash-token?utm_source=email" });
  assert.equal(token, "hash-token");
});

test("extractInviteTokenFromRoute decodes encoded token", () => {
  const token = extractInviteTokenFromRoute({ pathname: "/li/test%2Ftoken" });
  assert.equal(token, "test/token");
});

test("decideInviteNextAction returns pay when payment is required", () => {
  const nextAction = decideInviteNextAction({
    beginPayload: { paymentRequired: true },
    claimPayload: {},
  });
  assert.equal(nextAction, "pay");
});

test("decideInviteNextAction returns accept when payment is not required", () => {
  const nextAction = decideInviteNextAction({
    beginPayload: { paymentRequired: false },
    claimPayload: { requires_payment: false },
  });
  assert.equal(nextAction, "accept");
});
