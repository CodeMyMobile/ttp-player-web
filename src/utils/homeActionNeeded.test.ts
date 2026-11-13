import assert from "node:assert/strict";
import test from "node:test";

import type { HomeAlert } from "./homeAlertStack";
import { buildActionRows } from "./homeActionNeeded";
import type { HomeInviteItem } from "./homeInvite";

const invite = (over: Partial<HomeInviteItem>): HomeInviteItem => ({
  id: 1,
  token: "tok-1",
  senderName: "Alex Rivera",
  initials: "AR",
  whenLabel: "Sat, Nov 14 · 9:00 AM",
  locationLabel: "Penmar Park",
  startsAt: null,
  deadlineAt: null,
  ...over,
});

const pickup: HomeAlert = {
  id: "restring-9",
  type: "restring_pickup",
  tone: "violet",
  title: "Ready for pickup",
  subtitle: "Tennis Garage",
  destination: "/restring",
  deadlineAt: null,
};

test("invites and pickups, soonest deadline first, no deadline last", () => {
  const rows = buildActionRows({
    alerts: [pickup],
    invites: [
      invite({ id: 1, startsAt: Date.parse("2026-11-16T17:00:00Z") }),
      invite({ id: 2, deadlineAt: "2026-11-14T08:00:00Z", startsAt: Date.parse("2026-11-20T17:00:00Z") }),
    ],
  });
  assert.deepEqual(rows.map((row) => row.key), ["invite-2", "invite-1", "restring-9"]);
});

test("an invite row says who and when, and opens the invite page", () => {
  const [row] = buildActionRows({ invites: [invite({})] });
  assert.equal(row.title, "Alex Rivera wants to play");
  assert.equal(row.detail, "Sat, Nov 14 · 9:00 AM · Penmar Park");
  assert.equal(row.href, "/i/tok-1");
  assert.equal(row.cta, "Respond");
});

test("a pickup row names the racket and the shop", () => {
  const [row] = buildActionRows({ alerts: [pickup] });
  assert.equal(row.title, "Racket ready for pickup");
  assert.equal(row.detail, "Tennis Garage");
  assert.equal(row.href, "/restring");
});

test("rows without a deadline keep their order", () => {
  const rows = buildActionRows({ invites: [invite({ id: 1 }), invite({ id: 2 })], alerts: [pickup] });
  assert.deepEqual(rows.map((row) => row.key), ["invite-1", "invite-2", "restring-9"]);
});
