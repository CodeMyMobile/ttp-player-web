import { Link } from "react-router-dom";
import {
  feedCtaLabel,
  feedMetaLabel,
  feedPriceLabel,
  feedTimeLabel,
  feedTypeLabel,
  type FeedItem,
} from "../../utils/homeFeedLabels";

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
  const price = feedPriceLabel(item.price);
  const type = String(item.type ?? "");
  const initials = typeof item.avatar === "string" ? item.avatar : null;
  const avatarUrl = typeof item.avatarUrl === "string" ? item.avatarUrl : null;

  return (
    <article className={`home-feed__card home-feed__card--${type || "other"}`}>
      <span className="home-feed__avatar" aria-hidden="true">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials}</span>}
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
