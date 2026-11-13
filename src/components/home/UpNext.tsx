import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { WeekDayItems } from "../../features/myWeek/types";
import { buildUpNext } from "../../utils/homeUpNext";

interface UpNextProps {
  days: WeekDayItems[];
  loading: boolean;
  /** "My week" when the My Week tab exists, else the schedule. */
  weekHref: string;
  weekLabel: string;
  /** Scrolls to Play this week, for the empty state. */
  onFindSomething: () => void;
}

/**
 * "Up next": the next booked thing as a card, then the rest of the week as a short list.
 * Replaces the 7-day strip. The only home section with an empty state: an empty week is
 * worth saying, and the button below it is the way out.
 *
 * "Message players" isn't drawn: the app has no messaging yet.
 */
export function UpNext({ days, loading, weekHref, weekLabel, onFindSomething }: UpNextProps) {
  const { hero, rest } = buildUpNext(days, Date.now());

  return (
    <section className="home-sec home-upnext" aria-labelledby="home-upnext-title" aria-busy={loading}>
      <div className="home-sec__head">
        <h2 id="home-upnext-title" className="home-sec__title">
          Up next
        </h2>
        <Link className="home-sec__link" to={weekHref}>
          {weekLabel}
        </Link>
      </div>

      {loading ? (
        <div className="home-card home-upnext__hero home-skeleton" aria-hidden="true">
          <span className="home-skeleton__line home-skeleton__line--short" />
          <span className="home-skeleton__line home-skeleton__line--big" />
          <span className="home-skeleton__line" />
        </div>
      ) : hero ? (
        <>
          <article className="home-card home-upnext__hero">
            <div className="home-upnext__top">
              <span className={`home-tag home-tag--${hero.tone}`}>{hero.tag}</span>
              <span className="home-chip home-chip--success">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                You're in
              </span>
            </div>
            <Link className="home-upnext__main" to={hero.item.href ?? weekHref}>
              <span className="home-upnext__when">{hero.when}</span>
              <span className="home-upnext__title">{hero.item.title}</span>
              {hero.venue ? <span className="home-upnext__venue">{hero.venue}</span> : null}
            </Link>
            {hero.directionsUrl ? (
              <div className="home-upnext__actions">
                <a className="home-btn home-btn--outline" href={hero.directionsUrl} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </div>
            ) : null}
          </article>

          {rest.length ? (
            <ul className="home-card home-upnext__list">
              {rest.map((entry) => (
                <li key={entry.item.id}>
                  <Link className="home-upnext__row" to={entry.item.href ?? weekHref}>
                    <span className="home-upnext__date" aria-hidden="true">
                      <span className="home-upnext__dow">{entry.dayShort}</span>
                      <span className="home-upnext__dom">{entry.dayNumber}</span>
                    </span>
                    <span className="home-upnext__row-copy">
                      <span className="home-upnext__row-title">{entry.item.title}</span>
                      <span className="home-upnext__row-when">{entry.when}</span>
                    </span>
                    <ChevronRight className="home-upnext__chevron" size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="home-card home-upnext__empty">
          <p>Nothing booked this week.</p>
          <button type="button" className="home-btn home-btn--outline" onClick={onFindSomething}>
            Find something to play
          </button>
        </div>
      )}
    </section>
  );
}
