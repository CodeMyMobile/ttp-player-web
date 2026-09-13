import { normalizeMatchRecord } from "../api/matches";
import { hasViewerWithdrawn } from "./scheduledLeagueMatches";
import { matchesToBookings, type WeekBooking } from "./weekBookings";

interface BuildParams {
  /** Rows from GET /matches?filter=my&status=upcoming. */
  upcoming?: unknown[];
  /** Rows from the same call at status=confirmed — where league matches sit. */
  confirmed?: unknown[];
  /** The account id, for deciding whether this player withdrew. */
  viewerId?: unknown;
  /** The stored user, so the normaliser can tell host from participant. */
  currentUser?: unknown;
}

/**
 * This player's matches, as week bookings for the home page.
 *
 * Every rule here was a reason match play did not appear on the home page at all:
 *
 *   - the rows arrive RAW. `startDateTimeIso`, `format` and `location` only exist
 *     after normalizeMatchRecord, and matchesToBookings reads all three, so
 *     un-normalised rows are dropped for having no start time.
 *   - a match the player WITHDREW from still comes back: filter=my joins
 *     participants without filtering on participant status.
 *   - `relationship` must be host or participant to count. These rows are scoped
 *     to the player by the server, so where the client cannot tell the role apart
 *     it says participant rather than discarding the row — the participant's
 *     player_id and the account id are not always the same number, and both roles
 *     count toward the week identically.
 *
 * Two statuses because league matches sit at "confirmed" and never "upcoming",
 * and the API filters on exact equality. A match holds one status so the lists
 * cannot legitimately overlap; summariseWeekBookings dedupes by kind:id anyway.
 */
export const buildMyMatchBookings = ({
  upcoming = [],
  confirmed = [],
  viewerId,
  currentUser,
}: BuildParams): WeekBooking[] => {
  const rows = [
    ...(Array.isArray(upcoming) ? upcoming : []),
    ...(Array.isArray(confirmed) ? confirmed : []).filter(
      (row) => !hasViewerWithdrawn(row, viewerId),
    ),
  ];

  if (!rows.length) return [];

  return matchesToBookings(
    rows.map((row) => {
      const match = normalizeMatchRecord(row, { currentUser });
      return {
        ...match,
        relationship: match.relationship === "host" ? "host" : "participant",
      };
    }),
  );
};
