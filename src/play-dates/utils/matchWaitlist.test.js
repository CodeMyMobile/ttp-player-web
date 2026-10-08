import assert from "node:assert/strict";
import test from "node:test";

import {
  formatWaitlistCount,
  formatWaitlistStanding,
  getMatchWaitlistState,
  readMatchWaitlist,
} from "./matchWaitlist.js";

const viewer = { isFull: true, isHost: false, isJoined: false, isActive: true, hasAccess: true };
const stateFor = (match, overrides = {}) =>
  getMatchWaitlistState({ waitlist: readMatchWaitlist(match), ...viewer, ...overrides });

test("a match payload without waitlist_count offers no waitlist at all", () => {
  for (const match of [{}, { waitlist_count: null }, { waitlist_count: "" }, null]) {
    assert.equal(readMatchWaitlist(match).supported, false);
    const state = stateFor(match);
    assert.equal(state.supported, false);
    assert.equal(state.canJoin, false);
    assert.equal(state.count, 0);
  }
});

test("a full match with an empty waitlist can be joined", () => {
  const state = stateFor({ waitlist_count: 0, waitlist_position: null });
  assert.equal(state.supported, true);
  assert.equal(state.canJoin, true);
  assert.equal(state.isWaitlisted, false);
});

test("a match with a free seat and nobody waiting is joined directly, not queued for", () => {
  const state = stateFor({ waitlist_count: 0 }, { isFull: false });
  assert.equal(state.canJoin, false);
  assert.equal(state.seatHeld, false);
});

test("a free seat held for the waitlist sends other players to the waitlist", () => {
  const state = stateFor({ waitlist_count: 2, waitlist_hold: true }, { isFull: false });
  assert.equal(state.seatHeld, true);
  assert.equal(state.canJoin, true);
  assert.equal(state.canClaim, false);
});

test("the hold is only ever taken from the payload", () => {
  const state = stateFor({ waitlist_count: 2 }, { isFull: false });
  assert.equal(state.seatHeld, false);
  assert.equal(state.canJoin, false);
});

test("a waitlisted player sees their standing and can leave", () => {
  const state = stateFor({ waitlist_count: 3, waitlist_position: 2 });
  assert.equal(state.isWaitlisted, true);
  assert.equal(state.position, 2);
  assert.equal(state.canLeave, true);
  assert.equal(state.canJoin, false);
  assert.equal(state.canClaim, false);
  assert.equal(state.awaitingOrganiser, false);
});

test("a waitlisted player waits on the organiser until the seat is opened to the waitlist", () => {
  const held = { waitlist_count: 3, waitlist_position: 2, waitlist_hold: true };
  const waiting = stateFor(held, { isFull: false });
  assert.equal(waiting.awaitingOrganiser, true);
  assert.equal(waiting.canClaim, false);

  const opened = stateFor({ ...held, waitlist_open: true }, { isFull: false });
  assert.equal(opened.awaitingOrganiser, false);
  assert.equal(opened.canClaim, true);
});

test("an opened flag means nothing once the match is full again", () => {
  const state = stateFor({ waitlist_count: 3, waitlist_position: 2, waitlist_open: true });
  assert.equal(state.isOpenToWaitlist, false);
  assert.equal(state.canClaim, false);
});

test("the host and seated players are never offered the waitlist", () => {
  const match = { waitlist_count: 1 };
  assert.equal(stateFor(match, { isHost: true, isJoined: true }).canJoin, false);
  assert.equal(stateFor(match, { isJoined: true }).canJoin, false);
  // A stale position on someone who has since been seated is ignored.
  assert.equal(stateFor({ ...match, waitlist_position: 1 }, { isJoined: true }).isWaitlisted, false);
});

test("a private match offers the waitlist only to someone with an invite", () => {
  const match = { waitlist_count: 0 };
  assert.equal(stateFor(match, { hasAccess: false }).canJoin, false);
  assert.equal(stateFor(match, { hasAccess: true }).canJoin, true);
});

test("a started or cancelled match has no waitlist", () => {
  const state = stateFor({ waitlist_count: 3, waitlist_position: 1 }, { isActive: false });
  assert.equal(state.supported, false);
  assert.equal(state.count, 0);
  assert.equal(state.isWaitlisted, false);
  assert.equal(state.canLeave, false);
});

test("only the host receives names, and only from a payload that carries them", () => {
  const entries = [{ player_id: 4 }, { player_id: 9 }];
  const match = { waitlist_count: 2, waitlist: entries };
  assert.deepEqual(stateFor(match, { isHost: true, isJoined: true }).entries, entries);
  assert.equal(stateFor(match).entries, null);
  assert.equal(stateFor({ waitlist_count: 2 }, { isHost: true, isJoined: true }).entries, null);
});

test("the host can promote or open only while a seat is free", () => {
  const match = { waitlist_count: 2, waitlist: [], waitlist_hold: true };
  const host = { isHost: true, isJoined: true };

  const full = stateFor(match, host);
  assert.equal(full.hostCanPromote, false);
  assert.equal(full.hostCanOpen, false);

  const free = stateFor(match, { ...host, isFull: false });
  assert.equal(free.hostCanPromote, true);
  assert.equal(free.hostCanOpen, true);

  const opened = stateFor({ ...match, waitlist_open: true }, { ...host, isFull: false });
  assert.equal(opened.hostCanPromote, true);
  assert.equal(opened.hostCanOpen, false);

  const empty = stateFor({ waitlist_count: 0, waitlist: [] }, { ...host, isFull: false });
  assert.equal(empty.hostCanOpen, false);
});

test("counts arriving as numeric strings are read; junk is not", () => {
  assert.equal(readMatchWaitlist({ waitlist_count: "3", waitlist_position: "2" }).position, 2);
  assert.equal(readMatchWaitlist({ waitlist_count: -1 }).supported, false);
  assert.equal(readMatchWaitlist({ waitlist_count: 2, waitlist_position: 0 }).position, null);
});

test("labels", () => {
  assert.equal(formatWaitlistCount(0), "");
  assert.equal(formatWaitlistCount(3), "3 on the waitlist");
  assert.equal(formatWaitlistStanding(2, 3), "You're #2 of 3 on the waitlist");
  assert.equal(formatWaitlistStanding(1, 1), "You're #1 on the waitlist");
});
