import { useState } from "react";
import { ExternalLink, Swords, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { usableAvatar } from "../../utils/avatar";
import {
  feedCtaLabel,
  feedInitials,
  feedMetaLabel,
  feedPriceLabel,
  feedTimeLabel,
  feedTypeLabel,
  type FeedItem,
} from "../../utils/homeFeedLabels";

/** Matches the mockups, which draw an icon rather than a glyph, and the action
 *  grid's lucide family. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  private: UserRound,
  group: Users,
  external: ExternalLink,
  match: Swords,
};

interface ActivityCardProps {
  item: FeedItem;
}

/**
 * One card in "Play this week".
 *
 * The legacy dashboard renders the whole card as a button; the mockups make the
 * card an article with the CTA as the only control, so the markup is rebuilt
 * rather than restyled. Every line is omitted when its data is missing, which is
 * why a card can be as short as a title and a type.
 */
export function ActivityCard({ item }: ActivityCardProps) {
  const time = feedTimeLabel(item);
  const meta = feedMetaLabel(item);
  const price = feedPriceLabel(item.price, Boolean(item.priceFrom));
  const type = String(item.type ?? "");
  const initials = feedInitials(item.avatar);
  const Icon = TYPE_ICONS[type] ?? UserRound;

  // Two ways an avatar fails here, and they need different guards.
  //
  // usableAvatar rejects a bucket root — "https://….amazonaws.com/" with no key
  // — before it ever reaches an <img>, so nothing is requested and the icon
  // shows immediately rather than after a failed load.
  //
  // onError covers the rest: a well-formed URL whose object is missing or
  // expired, which only announces itself when the request comes back. Tracked
  // per card so one bad URL cannot suppress a good one on another row.
  const [imageFailed, setImageFailed] = useState(false);
  const rawUrl = usableAvatar(item.avatarUrl);
  const avatarUrl = imageFailed ? null : rawUrl;

  return (
    <article className={`home-feed__card home-feed__card--${type || "other"}`}>
      <span className="home-feed__avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" onError={() => setImageFailed(true)} />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <Icon size={22} strokeWidth={1.75} />
        )}
      </span>

      <span className="home-feed__body">
        <span className="home-feed__type">{feedTypeLabel(item.type)}</span>
        {item.title ? <span className="home-feed__title">{item.title}</span> : null}
        {time ? <span className="home-feed__when">{time}</span> : null}
        {meta ? <span className="home-feed__where">{meta}</span> : null}
      </span>

      <span className="home-feed__tail">
        {/* Omitted when the price is unknown — an unpriced session must not
            silently read as free. */}
        {price ? <span className="home-feed__price">{price}</span> : null}
        {item.destination ? (
          <Link className="home-feed__cta" to={item.destination}>
            {feedCtaLabel(item.type)}
          </Link>
        ) : null}
      </span>
    </article>
  );
}
