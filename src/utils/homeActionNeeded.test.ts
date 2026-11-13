import assert from "node:assert/strict";
import test from "node:test";

import type { HomeAlert } from "./homeAlertStack";
import {
  ACTION_PREVIEW_COUNT,
  buildActionItems,
  buildActionRows,
  RESTRING_NUDGE_WEEKS,
  restringNudgeRow,
} from "./homeActionNeeded";
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

const NOW = Date.parse("2026-11-13T12:00:00Z");
const WEEK = 7 * 24 * 60 * 60 * 1000;
const restring = (over: Record<string, unknown>) => ({
  id: 1,
  fulfillment_status: "picked_up",
  items: [{ item_type: "restring", service_tier_id: 3 }],
  ...over,
});

test("the restring nudge shows once the last restring is 8 weeks old, not before", () => {
  assert.equal(RESTRING_NUDGE_WEEKS, 8);
  const at = (weeks: number) => new Date(NOW - weeks * WEEK).toISOString();
  assert.equal(restringNudgeRow([restring({ picked_up_at: at(7.9) })], NOW), null);
  const row = restringNudgeRow([restring({ picked_up_at: at(9) })], NOW);
  assert.equal(row?.detail, "Last restrung 9 weeks ago");
  assert.equal(row?.cta, "Book restring");
  assert.equal(row?.href, "/restring");
});

test("the latest restring counts, and a racket at the shop or ready means no nudge", () => {
  const old = restring({ id: 1, picked_up_at: new Date(NOW - 20 * WEEK).toISOString() });
  const recent = restring({ id: 2, picked_up_at: new Date(NOW - 2 * WEEK).toISOString() });
  assert.equal(restringNudgeRow([old, recent], NOW), null);
  assert.equal(restringNudgeRow([old, restring({ id: 3, fulfillment_status: "in_progress" })], NOW), null);
  // Ready may be on either status column.
  assert.equal(restringNudgeRow([old, restring({ id: 4, fulfillment_status: "", status: "ready_for_pickup" })], NOW), null);
  assert.notEqual(restringNudgeRow([old], NOW), null);
});

test("no restring on record, or only a racket purchase, makes no claim", () => {
  assert.equal(restringNudgeRow([], NOW), null);
  assert.equal(
    restringNudgeRow([restring({ items: [{ item_type: "racket" }], picked_up_at: "2025-01-01T00:00:00Z" })], NOW),
    null,
  );
});

test("one list: deadlines first, then a pickup, the rating card, and the nudge last", () => {
  const rows = buildActionRows({
    alerts: [pickup],
    invites: [invite({ id: 5, deadlineAt: "2026-11-20T08:00:00Z" })],
    restringOrders: [restring({ picked_up_at: "2026-06-01T00:00:00Z" })],
    now: NOW,
  });
  const items = buildActionItems({
    seasons: [{ id: "L1", endDate: "2026-11-30" }, { id: "L2", endDate: "2026-11-16" }],
    prompt: { title: "Confirm your 4.5", sub: "Play and log a match", href: "/matches" },
    rows,
  });
  assert.deepEqual(
    items.map((item) => item.key),
    ["league-L2", "invite-5", "league-L1", "restring-9", "rating", "restring-nudge"],
  );
  // The section shows three before See all, league cards included.
  assert.equal(ACTION_PREVIEW_COUNT, 3);
  assert.deepEqual(
    items.slice(0, ACTION_PREVIEW_COUNT).map((item) => item.kind),
    ["league", "row", "league"],
  );
});
