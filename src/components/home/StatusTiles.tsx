import { ChevronRight, Info, Sparkles, Swords } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveStatusTiles, type RatingState } from "../../utils/homeTiles";

interface StatusTilesProps {
  /** Null until the rating loads, or when the player has no rating at all. */
  rating: number | null;
  /** "unknown" while we are still finding out — see homeTiles.RatingState. */
  ratingState: RatingState;
  /** "3rd nearby", or null when the player isn't placed in the nearby ladder. */
  positionLabel: string | null;
  bookingsCount: number;
  /** "Next Sat 10 AM", or null when nothing is booked. */
  nextBookingLabel: string | null;
}

const formatRating = (rating: number | null) =>
  rating === null ? "—" : rating.toFixed(1);

/**
 * The pair of tiles under the header. Which pair is decided by
 * resolveStatusTiles — the left slot is gated on being rated, the right slot on
 * having bookings.
 *
 * No rating delta, no NTRP equivalence, and the position never names a club —
 * see the deliberate omissions in docs/home-backend-audit-v2.md. Each is cut
 * because the data can't support it honestly, not because it was forgotten.
 */
export function StatusTiles({
  rating,
  ratingState,
  positionLabel,
  bookingsCount,
  nextBookingLabel,
}: StatusTilesProps) {
  const { left, right, fullWidth } = resolveStatusTiles({ ratingState, bookingsCount });

  return (
    <section className="home-tiles">
      {left === "rating" ? (
        <Link className="home-tile home-tile--rating" to="/ladder">
          <span className="home-tile__label">
            Tennis Plan Rating
            <Info size={12} aria-hidden="true" />
          </span>
          <span className="home-tile__value">{formatRating(rating)}</span>
          {positionLabel ? <span className="home-tile__sub">{positionLabel}</span> : null}
        </Link>
      ) : left === "ratingUnknown" ? (
        /* We do not know yet, so we claim nothing. A placeholder in the rating
           tile's own shape, so the row does not resize when the answer lands. */
        <div className="home-tile home-tile--rating home-tile--pending" aria-busy="true">
          <span className="home-tile__label">Tennis Plan Rating</span>
          <span className="home-tile__value home-tile__value--placeholder" aria-hidden="true">
            &nbsp;
          </span>
          <span className="home-tile__sr-only">Loading your rating</span>
        </div>
      ) : (
        /* Points at match play, NOT at leagues.
         *
         * Any confirmed match result rates you — listConfirmedMatchResults has
         * no league filter, so a casual match counts exactly as a league match
         * does, and /log-result covers one already played.
         *
         * A league cannot be the first step until the player has a usable level.
         * The rating quiz writes self_rated_seed, which creates an estimated
         * level without pretending it is match-verified. */
        <Link
          className={`home-tile home-tile--prompt${fullWidth ? " home-tile--full" : ""}`}
          to="/rating-quiz"
        >
          <Swords className="home-tile__lead-icon" size={20} aria-hidden="true" />
          <span className="home-tile__prompt-copy">
            <span className="home-tile__prompt-title">Find your tennis level</span>
            <span className="home-tile__prompt-sub">
              Five questions, then save an estimate
            </span>
          </span>
          {fullWidth ? (
            <ChevronRight className="home-tile__chevron" size={16} aria-hidden="true" />
          ) : null}
        </Link>
      )}

      {right === "bookings" ? (
        <Link className="home-tile home-tile--bookings" to="/player/calendar">
          <span className="home-tile__label home-tile__label--spread">
            This week
            <span className="home-tile__link-hint">See all</span>
          </span>
          <span className="home-tile__value-row">
            <span className="home-tile__value">{bookingsCount}</span>
            <span className="home-tile__unit">booked</span>
          </span>
          {nextBookingLabel ? (
            <span className="home-tile__sub home-tile__sub--muted">{nextBookingLabel}</span>
          ) : null}
        </Link>
      ) : null}

      {right === "playFirst" ? (
        <Link className="home-tile home-tile--bookings home-tile--prompt-compact" to="/matches">
          <Sparkles className="home-tile__lead-icon" size={20} aria-hidden="true" />
          <span className="home-tile__prompt-title">Play your first match</span>
          <span className="home-tile__prompt-sub">Your rating settles as you play</span>
        </Link>
      ) : null}
    </section>
  );
}
