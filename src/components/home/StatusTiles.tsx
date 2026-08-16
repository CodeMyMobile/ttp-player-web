import { ChevronRight, Info, LineChart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface StatusTilesProps {
  /** Null until the rating loads, or when the player has no rating at all. */
  rating: number | null;
  isRated: boolean;
  /** "3rd nearby", or null when the player isn't placed in the nearby ladder. */
  positionLabel: string | null;
  bookingsCount: number;
  /** "Next Sat 10 AM", or null when nothing is booked. */
  nextBookingLabel: string | null;
}

const formatRating = (rating: number | null) =>
  rating === null ? "—" : rating.toFixed(1);

/**
 * The pair of tiles under the header. Three states, matching the mockups:
 *
 *   not rated          → a single full-width "Set your level" prompt
 *   rated, booked      → rating tile + bookings tile
 *   rated, nothing on  → rating tile + "Play your first match" prompt
 *
 * No rating delta, no NTRP equivalence, and the position never names a club —
 * see the deliberate omissions in docs/home-backend-audit-v2.md. Each is cut
 * because the data can't support it honestly, not because it was forgotten.
 */
export function StatusTiles({
  rating,
  isRated,
  positionLabel,
  bookingsCount,
  nextBookingLabel,
}: StatusTilesProps) {
  if (!isRated) {
    return (
      <section className="home-tiles">
        <Link className="home-tile home-tile--prompt home-tile--full" to="/match-profile/edit">
          <LineChart className="home-tile__lead-icon" size={20} aria-hidden="true" />
          <span className="home-tile__prompt-copy">
            <span className="home-tile__prompt-title">Set your level</span>
            <span className="home-tile__prompt-sub">2 minutes · see sessions that match you</span>
          </span>
          <ChevronRight className="home-tile__chevron" size={16} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="home-tiles">
      <Link className="home-tile home-tile--rating" to="/match-results">
        <span className="home-tile__label">
          Tennis Plan Rating
          <Info size={12} aria-hidden="true" />
        </span>
        <span className="home-tile__value">{formatRating(rating)}</span>
        {positionLabel ? (
          <span className="home-tile__sub">{positionLabel}</span>
        ) : null}
      </Link>

      {bookingsCount > 0 ? (
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
      ) : (
        <Link className="home-tile home-tile--bookings home-tile--prompt-compact" to="/matches">
          <Sparkles className="home-tile__lead-icon" size={20} aria-hidden="true" />
          <span className="home-tile__prompt-title">Play your first match</span>
          <span className="home-tile__prompt-sub">Your rating settles as you play</span>
        </Link>
      )}
    </section>
  );
}
