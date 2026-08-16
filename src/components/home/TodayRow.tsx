import { ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { bookingMetaLabel, todayTimeLabel, type WeekBooking } from "../../utils/weekBookings";

interface TodayRowProps {
  /** The soonest booking still to come today, or null when there is none. */
  booking: WeekBooking | null;
}

/**
 * A match opens the match; a lesson or group lesson opens the schedule, since
 * neither has a player-facing detail route of its own.
 */
const destinationFor = (booking: WeekBooking) =>
  booking.kind === "match" ? `/matches/${booking.id}` : "/player/calendar";

/**
 * "Today, 6:00 PM · Cardio tennis · Penmar" — the red-chip row directly under
 * the status tiles.
 *
 * Renders nothing at all when nothing is left today. There is no empty state
 * and no reserved space: the mockups run these sections sequentially, so the
 * alert stack simply moves up into this slot (see rated-no-bookings.html).
 */
export function TodayRow({ booking }: TodayRowProps) {
  if (!booking) return null;

  const time = todayTimeLabel(booking);
  if (!time) return null;

  // Null whenever the source carried neither a title nor a venue — a private
  // lesson usually carries neither, and a row with a lone "·" is worse than a
  // row with just the time.
  const meta = bookingMetaLabel(booking);

  return (
    <section className="home-today">
      <Link className="home-today__row" to={destinationFor(booking)}>
        <span className="home-today__chip" aria-hidden="true">
          <Clock size={16} />
        </span>
        <span className="home-today__copy">
          <span className="home-today__title">{time}</span>
          {meta ? <span className="home-today__meta">{meta}</span> : null}
        </span>
        <ChevronRight className="home-today__chevron" size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
