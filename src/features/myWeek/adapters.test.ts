process.env.TZ = "America/Los_Angeles";

import test from "node:test";
import assert from "node:assert/strict";

import { weekDays } from "../../utils/weekDays";
import {
  countNeedsResponse,
  groupWeek,
  leagueDueToWeekItems,
  lessonsToWeekItems,
  myMatchesToWeekItems,
  receivedInvitesToWeekItems,
  sentInvitesToWeekItems,
} from "./adapters";

// Friday 6 Nov 2026, 10am in Los Angeles.
const NOW = new Date(2026, 10, 6, 10, 0);
const NOW_MS = NOW.getTime();
const HOUR = 3_600_000;
const DAYS = weekDays(NOW);
// The player: account id 10, and how their name and email appear on records.
const ME = new Set(["10", "sam rivera", "sam@example.com"]);
const at = (hoursFromNow: number) => new Date(NOW_MS + hoursFromNow * HOUR).toISOString();

// --- lessons ------------------------------------------------------------------------------

test("a private lesson counts once the coach confirms it", () => {
  const items = lessonsToWeekItems(
    [
      { id: 1, lessontype_id: 1, status: 1, start_date_time: at(24), full_name: "Paul Cochrane", lesson_type_name: "Private lesson", location: "Penmar" },
      { id: 2, lessontype_id: 1, status: 0, start_date_time: at(24) },
      { id: 3, lessontype_id: 2, status: 2, start_date_time: at(24) },
    ],
    ME,
    DAYS,
  );
  assert.deepEqual(items.map((item) => item.id), ["lesson:1"]);
  assert.equal(items[0].title, "Private lesson with Paul Cochrane");
  assert.equal(items[0].subtitle, "Penmar");
  assert.equal(items[0].href, "/player/lesson/1");
  assert.equal(items[0].state, "booked");
});

test("a group class counts when this player's own place holds a spot", () => {
  const me = { player_id: 10, full_name: "Sam Rivera", email: "sam@example.com", status: 1, payment_status: 1, payment_method: "stripe" };
  const other = { player_id: 77, full_name: "Alex Kim", profile_picture: "alex.jpg", status: 1, payment_status: 1, payment_method: "stripe" };
  const items = lessonsToWeekItems(
    [
      // Saturday 9pm at the venue, stored with a Z.
      { id: 5, lessontype_id: 3, status: 1, start_date_time: "2026-11-07T21:00:00.000Z", group_players: [me, other] },
      // Booked, but this player cancelled their place.
      { id: 6, lessontype_id: 3, status: 1, start_date_time: "2026-11-07T21:00:00.000Z", group_players: [{ ...me, status: 2, payment_status: 2 }] },
      // Only someone else is on it.
      { id: 7, lessontype_id: 4, status: 1, start_date_time: "2026-11-07T21:00:00.000Z", group_players: [other] },
      // The coach cancelled the class.
      { id: 8, lessontype_id: 3, status: 2, created_by: 20, updated_by: 20, start_date_time: "2026-11-07T21:00:00.000Z", group_players: [me] },
    ],
    ME,
    DAYS,
  );
  assert.deepEqual(items.map((item) => item.id), ["groupLesson:5"]);
  assert.equal(items[0].dayKey, "2026-11-07");
  assert.deepEqual(items[0].time, { kind: "fixed", startsAt: new Date(2026, 10, 7, 21, 0).getTime() });
  assert.deepEqual(items[0].people, [{ id: "77", name: "Alex Kim", photoUrl: "alex.jpg" }]);
});

test("lessons outside the seven days are left off", () => {
  const items = lessonsToWeekItems(
    [{ id: 9, lessontype_id: 1, status: 1, start_date_time: at(7 * 24 + 1) }],
    ME,
    DAYS,
  );
  assert.deepEqual(items, []);
});

// --- matches ------------------------------------------------------------------------------

const match = (overrides: Record<string, unknown> = {}) => ({
  id: 40,
  status: "upcoming",
  start_date_time: at(30),
  location_text: "Penmar Park",
  host_id: 10,
  participants: [
    { player_id: 10, status: "hosting", profile: { full_name: "Sam Rivera" } },
    { player_id: 77, status: "confirmed", profile: { full_name: "Alex Kim", profile_picture: "alex.jpg" } },
  ],
  invitees: [],
  ...overrides,
});

test("matches this player hosts or plays in are booked", () => {
  const [item] = myMatchesToWeekItems([match()], ME, DAYS);
  assert.equal(item.id, "match:40");
  assert.equal(item.title, "Match at Penmar Park");
  assert.deepEqual(item.people, [{ id: "77", name: "Alex Kim", photoUrl: "alex.jpg" }]);
  assert.equal(item.href, "/matches/40");
});

test("a match this player left, or is only invited to, isn't booked", () => {
  const left = match({ id: 41, host_id: 77, participants: [{ player_id: 10, status: "left" }, { player_id: 77, status: "hosting" }] });
  const invited = match({ id: 42, host_id: 77, participants: [{ player_id: 10, status: "invited" }] });
  assert.deepEqual(myMatchesToWeekItems([left, invited], ME, DAYS), []);
});

test("when the player's own row can't be found, the server's scoping is trusted", () => {
  const unknownIds = match({ id: 43, host_id: 999, participants: [{ player_id: 555, status: "hosting" }] });
  assert.deepEqual(myMatchesToWeekItems([unknownIds], ME, DAYS).map((item) => item.id), ["match:43"]);
});

// --- invites I sent -----------------------------------------------------------------------

const invite = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  invitee_id: 88,
  inviter_id: 10,
  status: "pending",
  joined: false,
  created_at: at(-2),
  expires_at: at(100),
  profile: { full_name: "Jo Park", profile_picture: "jo.jpg" },
  ...overrides,
});

test("a fresh sent invite is pending but doesn't need a nudge yet", () => {
  const [item] = sentInvitesToWeekItems([match({ invitees: [invite()] })], ME, DAYS, NOW_MS);
  assert.equal(item.id, "sentInvite:40");
  assert.equal(item.state, "pending");
  assert.equal(item.needsResponse, false);
  assert.equal(item.reason, "Waiting on Jo · 2h");
  assert.deepEqual(item.actions, ["open"]);
});

test("a sent invite needs a nudge after 48 hours, or within 24 hours of the match", () => {
  const waited = sentInvitesToWeekItems([match({ invitees: [invite({ created_at: at(-49) })] })], ME, DAYS, NOW_MS);
  assert.equal(waited[0].needsResponse, true);
  assert.equal(waited[0].reason, "Waiting on Jo · 2 days");
  assert.deepEqual(waited[0].actions, ["nudge", "open"]);

  const soon = sentInvitesToWeekItems([match({ start_date_time: at(20), invitees: [invite()] })], ME, DAYS, NOW_MS);
  assert.equal(soon[0].needsResponse, true);
});

test("answered, joined, expired, or someone else's invites aren't waiting on this player", () => {
  const invitees = [
    invite({ id: 2, status: "accepted" }),
    invite({ id: 3, joined: true }),
    invite({ id: 4, expires_at: at(-1) }),
    invite({ id: 5, inviter_id: 77 }),
  ];
  assert.deepEqual(sentInvitesToWeekItems([match({ invitees })], ME, DAYS, NOW_MS), []);
});

// --- invites I received -------------------------------------------------------------------

const received = (overrides: Record<string, unknown> = {}) => ({
  id: 60,
  token: "tok123",
  status: "pending",
  expires_at: at(48),
  inviter_id: 77,
  inviter: { user_id: 77, full_name: "Alex Kim", profile_picture: "alex.jpg", phone: "3105550111", email: "alex@example.com" },
  match: { id: 44, start_date_time: at(26), location_text: "Penmar Park" },
  ...overrides,
});

test("an invite this week waits for the player's yes or no, showing only the inviter's name and photo", () => {
  const [item] = receivedInvitesToWeekItems([received()], DAYS, NOW_MS);
  assert.equal(item.id, "invite:60");
  assert.equal(item.needsResponse, true);
  assert.equal(item.reason, "Alex invited you");
  assert.deepEqual(item.people, [{ id: "77", name: "Alex Kim", photoUrl: "alex.jpg" }]);
  assert.deepEqual(item.actions, ["accept", "decline", "open"]);
  assert.equal(item.href, "/invites/tok123");
});

test("expired invites, and invites for matches beyond the week, are left off", () => {
  assert.deepEqual(
    receivedInvitesToWeekItems(
      [received({ id: 61, expires_at: at(-1) }), received({ id: 62, match: { id: 45, start_date_time: at(8 * 24) } })],
      DAYS,
      NOW_MS,
    ),
    [],
  );
});

// --- league fixtures due ------------------------------------------------------------------

const league = { id: 7, name: "Fall Flex League", end_date: "2026-11-10T00:00:00.000Z" };
const fixture = (overrides: Record<string, unknown> = {}) => ({
  id: 300,
  league_id: 7,
  player1_id: 10,
  player1_name: "Sam Rivera",
  player2_id: 77,
  player2_name: "Alex Kim",
  status: "scheduled",
  ...overrides,
});

test("an unplayed fixture is due in the league's final week, on its end date", () => {
  const [item] = leagueDueToWeekItems([{ league, fixtures: [fixture()] }], ME, DAYS, []);
  assert.equal(item.id, "leagueDue:300");
  assert.equal(item.dayKey, "2026-11-10");
  assert.deepEqual(item.time, { kind: "flexible", label: "Due by Tue" });
  assert.equal(item.title, "League match vs Alex Kim");
  assert.equal(item.needsResponse, true);
  assert.equal(item.href, "/leagues/7/dashboard");
});

test("nothing is due for a league ending later, without an end date, or for a played fixture", () => {
  assert.deepEqual(
    leagueDueToWeekItems(
      [
        { league: { ...league, end_date: "2026-11-20" }, fixtures: [fixture()] },
        { league: { ...league, end_date: null }, fixtures: [fixture()] },
        { league, fixtures: [fixture({ status: "confirmed", match_result_id: 9 })] },
      ],
      ME,
      DAYS,
      [],
    ),
    [],
  );
});

test("a fixture already booked as a league match isn't also due", () => {
  const bookedLeagueMatch = match({
    id: 46,
    is_league_match: true,
    league_id: 7,
    participants: [
      { player_id: 10, status: "confirmed" },
      { player_id: 77, status: "confirmed", profile: { full_name: "Alex Kim" } },
    ],
  });
  assert.deepEqual(leagueDueToWeekItems([{ league, fixtures: [fixture()] }], ME, DAYS, [bookedLeagueMatch]), []);
});

// --- the week -----------------------------------------------------------------------------

test("the week groups by day, timed items first, and counts what's waiting", () => {
  const items = [
    ...leagueDueToWeekItems([{ league, fixtures: [fixture()] }], ME, DAYS, []),
    ...myMatchesToWeekItems([match({ id: 47, start_date_time: "2026-11-10T20:00:00.000Z" })], ME, DAYS),
    ...receivedInvitesToWeekItems([received()], DAYS, NOW_MS),
  ];
  const week = groupWeek(items, DAYS);
  assert.equal(week.length, 7);
  const tuesday = week.find((day) => day.dayKey === "2026-11-10")!;
  assert.deepEqual(tuesday.items.map((item) => item.id), ["match:47", "leagueDue:300"]);
  assert.equal(tuesday.load, 2);
  assert.equal(tuesday.hasWaiting, true);
  assert.equal(countNeedsResponse(week), 2);
});

test("duplicates drop, and an invite for a match already booked isn't shown twice", () => {
  const booked = myMatchesToWeekItems([match({ id: 44 })], ME, DAYS);
  const invites = receivedInvitesToWeekItems([received()], DAYS, NOW_MS);
  const week = groupWeek([...booked, ...booked, ...invites], DAYS);
  assert.deepEqual(week.flatMap((day) => day.items).map((item) => item.id), ["match:44"]);
});
