import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { ViewerState } from "../../utils/homeBookingState";
import { normalizeVenueLabel } from "../../utils/venueLabel";
import {
  feedCtaLabel,
  feedPriceLabel,
  feedTimeLabel,
  feedTypeLabel,
  type FeedItem,
} from "../../utils/homeFeedLabels";

interface ActivityCardProps {
  item: FeedItem;
  /** Already in it, or coaching it (utils/homeBookingState): no Join or Book then. */
  viewerState?: ViewerState;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * One row in "Play this week": a type tag, the title, "Today · 9:00 AM · venue", level and
 * price as chips, and one outline action. Every part is omitted when its data is missing.
 *
 * An external lesson is booked on the provider's own site, so its Book opens that site in
 * a new tab and says so.
 */
export function ActivityCard({ item, viewerState = null }: ActivityCardProps) {
  const type = String(item.type ?? "");
  const external = type === "external";
  const provider = text(item.provider);
  const externalUrl = external ? text(item.externalUrl) : null;
  const location = text(item.location);
  const venue = location && location !== "Location TBD" ? normalizeVenueLabel(location) || location : null;
  const coach = type === "group" && text(item.coachName) ? `Coach ${text(item.coachName)}` : null;
  const meta = [feedTimeLabel(item), venue, coach].filter(Boolean).join(" · ") || null;
  // An unknown price is left out: an unpriced session must not read as free.
  const price = viewerState ? null : feedPriceLabel(item.price, Boolean(item.priceFrom));
  const level = text(item.levelLabel);
  const tag = external ? ["Lesson", provider].filter(Boolean).join(" · ") : feedTypeLabel(item.type);

  return (
    <li className="home-feed__row">
      <span className="home-feed__body">
        <span className={`home-tag home-tag--${type || "other"}`}>{tag}</span>
        {item.title ? <span className="home-feed__title">{item.title}</span> : null}
        {meta ? <span className="home-feed__meta">{meta}</span> : null}
        {level || price ? (
          <span className="home-feed__chips">
            {level ? <span className="home-chip home-chip--level">{level}</span> : null}
            {price ? <span className="home-chip home-chip--neutral">{price}</span> : null}
          </span>
        ) : null}
      </span>

      {viewerState === "coaching" ? (
        <span className="home-chip home-chip--neutral home-feed__coaching">You're coaching</span>
      ) : viewerState === "in" && item.destination ? (
        <Link className="home-btn home-btn--in home-btn--small" to={item.destination}>
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          You're in
        </Link>
      ) : externalUrl ? (
        <a
          className="home-btn home-btn--outline home-btn--small"
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Book on ${provider ?? "their site"} (opens their site)`}
        >
          Book
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ) : item.destination ? (
        <Link className="home-btn home-btn--outline home-btn--small" to={item.destination}>
          {feedCtaLabel(item.type)}
        </Link>
      ) : null}
    </li>
  );
}
