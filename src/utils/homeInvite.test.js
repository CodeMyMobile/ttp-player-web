import assert from "node:assert/strict";
import test from "node:test";

import {
  declinePromptFor,
  inviteMetaLabel,
  moreInvitesLabel,
  selectHomeInvite,
  sortInvitesBySoonest,
} from "./homeInvite";

const invite = (overrides = {}) => ({
  id: 1,
  token: "tok",
  senderName: "Mike Dorsey",
  initials: "MD",
  ...overrides,
});

test("sorts soonest match first, not by server order", () => {
  // GET /invites returns created_at DESC, so the incoming order is close to
  // arbitrary with respect to which match needs an answer first.
  const sorted = sortInvitesBySoonest([
    invite({ id: "later", startsAt: 3_000 }),
    invite({ id: "soonest", startsAt: 1_000 }),
    invite({ id: "middle", startsAt: 2_000 }),
  ]);

  assert.deepEqual(
    sorted.map((i) => i.id),
    ["soonest", "middle", "later"],
  );
});

test("falls back to the expiry when there is no match start", () => {
  const sorted = sortInvitesBySoonest([
    invite({ id: "no-start-late", deadlineAt: "2026-08-20T00:00:00Z" }),
    invite({ id: "has-start", startsAt: Date.parse("2026-08-18T00:00:00Z") }),
    invite({ id: "no-start-early", deadlineAt: "2026-08-17T00:00:00Z" }),
  ]);

  assert.deepEqual(
    sorted.map((i) => i.id),
    ["no-start-early", "has-start", "no-start-late"],
  );
});

test("an invite with neither start nor expiry sorts last, never first", () => {
  // The zero-versus-null trap: a missing timestamp must not read as epoch 0 and
  // jump the queue ahead of real matches.
  const sorted = sortInvitesBySoonest([
    invite({ id: "unknown" }),
    invite({ id: "real", startsAt: 5_000 }),
  ]);

  assert.deepEqual(
    sorted.map((i) => i.id),
    ["real", "unknown"],
  );
});

test("equal times keep server order rather than shuffling", () => {
  const sorted = sortInvitesBySoonest([
    invite({ id: "a", startsAt: 1_000 }),
    invite({ id: "b", startsAt: 1_000 }),
    invite({ id: "c", startsAt: 1_000 }),
  ]);

  assert.deepEqual(
    sorted.map((i) => i.id),
    ["a", "b", "c"],
  );
});

test("only the soonest is selected, and the rest are counted", () => {
  const { invite: chosen, remaining } = selectHomeInvite([
    invite({ id: "later", startsAt: 2_000 }),
    invite({ id: "soonest", startsAt: 1_000 }),
    invite({ id: "latest", startsAt: 3_000 }),
  ]);

  assert.equal(chosen.id, "soonest");
  assert.equal(remaining, 2);
});

test("one invite means no remainder, and none means no card", () => {
  assert.deepEqual(selectHomeInvite([invite({ startsAt: 1 })]).remaining, 0);

  const empty = selectHomeInvite([]);
  assert.equal(empty.invite, null);
  assert.equal(empty.remaining, 0);
});

test("junk input does not throw or invent a card", () => {
  assert.equal(selectHomeInvite(null).invite, null);
  assert.equal(selectHomeInvite(undefined).invite, null);
  assert.deepEqual(sortInvitesBySoonest([null, undefined]).length, 0);
});

test("the more-invites link pluralises, and vanishes at zero", () => {
  assert.equal(moreInvitesLabel(1), "1 more invite");
  assert.equal(moreInvitesLabel(2), "2 more invites");
  assert.equal(moreInvitesLabel(0), null);
  assert.equal(moreInvitesLabel(-1), null);
  assert.equal(moreInvitesLabel(NaN), null);
});

test("the decline prompt says notified, never texted", () => {
  // POST /invites/reject swallows the SMS error and always returns success, so
  // the client cannot confirm delivery and must not claim it.
  const prompt = declinePromptFor(invite());
  assert.equal(prompt, "Decline this match? Mike will be notified.");
  assert.ok(!/text/i.test(prompt));
});

test("the decline prompt survives a missing sender name", () => {
  assert.equal(
    declinePromptFor(invite({ senderName: "   " })),
    "Decline this match? They will be notified.",
  );
  assert.equal(declinePromptFor(null), "Decline this match? They will be notified.");
  assert.ok(!/undefined/.test(declinePromptFor(invite({ senderName: undefined }))));
});

test("the meta line joins what exists and omits what doesn't", () => {
  assert.equal(
    inviteMetaLabel(
      invite({ description: "4.0 Flex", whenLabel: "Sat 9 Aug, 10 AM", locationLabel: "Penmar" }),
    ),
    "4.0 Flex · Sat 9 Aug, 10 AM · Penmar",
  );
  assert.equal(inviteMetaLabel(invite({ whenLabel: "Sat 9 Aug, 10 AM" })), "Sat 9 Aug, 10 AM");
  assert.equal(inviteMetaLabel(invite()), null);
  assert.equal(inviteMetaLabel(null), null);
});
