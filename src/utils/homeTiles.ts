/**
 * Which pair of status tiles the home page shows.
 *
 * The two slots are decided independently, and that is the point:
 *
 *   left  — the rating, or a prompt to get one. Gated on the rating state.
 *   right — bookings, or a prompt to play. Gated on HAVING BOOKINGS, not on
 *           being rated.
 *
 * The right slot used to be gated on the rating too, which was defensible when
 * unrated meant brand new. It isn't now — the unrated state is the majority
 * (1134 of 1203 accounts), and it includes people with a standing weekly lesson
 * and no match history. They have real bookings and were being shown nothing.
 */

/**
 * Three states, not a boolean.
 *
 * This used to take `isRated: boolean`, computed as `Boolean(data?.ranked)`,
 * which flattened three different situations into one answer:
 *
 *   the player is not rated
 *   the answer has not arrived yet
 *   the request was skipped or failed
 *
 * All three came out false, and false renders "Play a match to get rated" — so
 * a player with 13 matches and rank 23 was told to go and play a match whenever
 * the call was slow, errored, or never fired because their viewer id had not
 * resolved. `unknown` exists so the tile can decline to make a claim.
 */
export type RatingState = "rated" | "unrated" | "unknown";

export type LeftTile = "rating" | "getRated" | "ratingUnknown";
export type RightTile = "bookings" | "playFirst" | null;

export interface StatusTileLayout {
  left: LeftTile;
  right: RightTile;
  /** The get-rated prompt fills the row when there's nothing to put beside it. */
  fullWidth: boolean;
}

export function resolveStatusTiles({
  ratingState,
  bookingsCount,
}: {
  ratingState: RatingState;
  bookingsCount: number;
}): StatusTileLayout {
  const hasBookings = bookingsCount > 0;
  const left: LeftTile =
    ratingState === "rated" ? "rating" : ratingState === "unrated" ? "getRated" : "ratingUnknown";

  if (hasBookings) {
    return { left, right: "bookings", fullWidth: false };
  }

  // Unrated with nothing booked: the get-rated prompt already says "play a
  // match", so pairing it with the play-your-first-match prompt would say the
  // same thing twice. It takes the full row instead, as the cold mockup draws it.
  if (ratingState === "unrated") {
    return { left, right: null, fullWidth: true };
  }

  // Unknown keeps the two-column shape and puts nothing beside itself. Going
  // full-width would make the row jump when the answer lands, and "play your
  // first match" is a claim we are in no position to make — the player we
  // cannot classify may well have played fifty.
  if (ratingState === "unknown") {
    return { left, right: null, fullWidth: false };
  }

  return { left, right: "playFirst", fullWidth: false };
}
