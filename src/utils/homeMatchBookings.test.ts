import assert from "node:assert/strict";
import test from "node:test";

import { buildMyMatchBookings } from "./homeMatchBookings";

const VIEWER_ID = 1716;
const IN_TWO_DAYS = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

/** A row shaped like GET /matches returns it — raw, not normalised. */
const rawMatch = (overrides: Record<string, unknown> = {}) => ({
  id: 292,
  host_id: 10,
  match_type: "open",
  status: "upcoming",
  start_date_time: IN_TWO_DAYS,
  location_text: "Griffin Club Los Angeles",
  match_format: "Dingles",
  player_limit: 12,
  is_hidden: true,
  participants: [{ player_id: VIEWER_ID, status: "confirmed" }],
  ...overrides,
});

test("a joined match becomes a booking, from the raw API row", () => {
  const [booking, ...rest] = buildMyMatchBookings({
    upcoming: [rawMatch()],
    viewerId: VIEWER_ID,
  });

  assert.equal(rest.length, 0);
  assert.equal(booking.id, "292");
  assert.equal(booking.kind, "match");
  assert.equal(booking.title, "Dingles");
  assert.equal(booking.location, "Griffin Club Los Angeles");
  // The start time has to survive: matchesToBookings drops anything it cannot
  // place on a clock, which is what happened to every un-normalised row.
  assert.ok(Number.isFinite(booking.startsAt));
});

/**
 * A link-only match is still yours once you have joined it. The API only returns
 * it when asked for hidden rows, so this asserts the row is not discarded again
 * on the client for being hidden.
 */
test("a link-only match is kept", () => {
  const bookings = buildMyMatchBookings({
    upcoming: [rawMatch({ is_hidden: true })],
    viewerId: VIEWER_ID,
  });

  assert.equal(bookings.length, 1);
});

test("league matches at status confirmed are included", () => {
  const bookings = buildMyMatchBookings({
    confirmed: [rawMatch({ id: 301, status: "confirmed", is_league_match: true })],
    viewerId: VIEWER_ID,
  });

  assert.deepEqual(
    bookings.map((booking) => booking.id),
    ["301"],
  );
});

/**
 * filter=my joins participants without filtering on participant status, so a
 * match this player left still comes back from the API.
 */
test("a match the viewer withdrew from is dropped", () => {
  const bookings = buildMyMatchBookings({
    confirmed: [
      rawMatch({
        id: 302,
        status: "confirmed",
        participants: [{ player_id: VIEWER_ID, status: "cancelled" }],
      }),
    ],
    viewerId: VIEWER_ID,
  });

  assert.deepEqual(bookings, []);
});

test("another player's withdrawal does not drop the match", () => {
  const bookings = buildMyMatchBookings({
    confirmed: [
      rawMatch({
        id: 303,
        status: "confirmed",
        participants: [
          { player_id: 999, status: "cancelled" },
          { player_id: VIEWER_ID, status: "confirmed" },
        ],
      }),
    ],
    viewerId: VIEWER_ID,
  });

  assert.deepEqual(
    bookings.map((booking) => booking.id),
    ["303"],
  );
});

/**
 * The rows are scoped to this player by the server. When the client cannot tell
 * the role — the participant's player_id and the account id are not always the
 * same number — the match must still count, not vanish.
 */
test("a row whose role cannot be resolved still counts", () => {
  const bookings = buildMyMatchBookings({
    upcoming: [rawMatch({ id: 304, participants: [{ player_id: 88888, status: "confirmed" }] })],
    viewerId: VIEWER_ID,
  });

  assert.deepEqual(
    bookings.map((booking) => booking.id),
    ["304"],
  );
});

test("a row with no usable start time is dropped rather than counted as now", () => {
  const bookings = buildMyMatchBookings({
    upcoming: [rawMatch({ id: 305, start_date_time: null })],
    viewerId: VIEWER_ID,
  });

  assert.deepEqual(bookings, []);
});

test("missing or failed sources yield no bookings rather than throwing", () => {
  assert.deepEqual(buildMyMatchBookings({}), []);
  assert.deepEqual(buildMyMatchBookings({ upcoming: undefined, confirmed: undefined }), []);
});
