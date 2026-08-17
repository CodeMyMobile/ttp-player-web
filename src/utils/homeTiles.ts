/**
 * Which pair of status tiles the home page shows.
 *
 * The two slots are decided independently, and that is the point:
 *
 *   left  — the rating, or a prompt to get one. Gated on being rated.
 *   right — bookings, or a prompt to play. Gated on HAVING BOOKINGS, not on
 *           being rated.
 *
 * The right slot used to be gated on the rating too, which was defensible when
 * unrated meant brand new. It isn't now — the unrated state is the majority
 * (1134 of 1203 accounts), and it includes people with a standing weekly lesson
 * and no match history. They have real bookings and were being shown nothing.
 */
export type LeftTile = "rating" | "getRated";
export type RightTile = "bookings" | "playFirst" | null;

export interface StatusTileLayout {
  left: LeftTile;
  right: RightTile;
  /** The get-rated prompt fills the row when there's nothing to put beside it. */
  fullWidth: boolean;
}

export function resolveStatusTiles({
  isRated,
  bookingsCount,
}: {
  isRated: boolean;
  bookingsCount: number;
}): StatusTileLayout {
  const hasBookings = bookingsCount > 0;
  const left: LeftTile = isRated ? "rating" : "getRated";

  if (hasBookings) {
    return { left, right: "bookings", fullWidth: false };
  }

  // Unrated with nothing booked: the get-rated prompt already says "play a
  // match", so pairing it with the play-your-first-match prompt would say the
  // same thing twice. It takes the full row instead, as the cold mockup draws it.
  if (!isRated) {
    return { left, right: null, fullWidth: true };
  }

  return { left, right: "playFirst", fullWidth: false };
}
