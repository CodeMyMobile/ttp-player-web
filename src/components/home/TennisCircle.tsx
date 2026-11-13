import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import { usableAvatar } from "../../utils/avatar";
import type { CircleRow } from "../../utils/homeCircle";

const PREVIEW_COUNT = 3;

interface TennisCircleProps {
  rows: CircleRow[];
  loading?: boolean;
}

function CircleAvatar({ row }: { row: CircleRow }) {
  // Tracked per row so one missing photo can't hide another (see ActivityCard).
  const [imageFailed, setImageFailed] = useState(false);
  const url = imageFailed ? null : usableAvatar(row.avatarUrl);
  return (
    <span className="home-circle__avatar" aria-hidden="true">
      {url ? <img src={url} alt="" onError={() => setImageFailed(true)} /> : <span>{row.initials}</span>}
    </span>
  );
}

/**
 * "Your tennis circle": open matches people the player knows are in, then classes from
 * their coaches (their own classes left out, for a coach who also plays). Rows and wording come from utils/homeCircle; this only draws them.
 * Hidden when there's nothing, so a player with no history sees no empty box.
 */
export function TennisCircle({ rows, loading = false }: TennisCircleProps) {
  const [expanded, setExpanded] = useState(false);
  const viewed = useRef(false);

  const matches = rows.filter((row) => row.kind === "match").length;
  const classes = rows.length - matches;

  // Once per page view, and only when there was something to see.
  useEffect(() => {
    if (viewed.current || !rows.length) return;
    viewed.current = true;
    track(ANALYTICS_EVENTS.homeCircleView, { matches, classes });
  }, [rows.length, matches, classes]);

  if (!rows.length) {
    if (!loading) return null;
    return (
      <section className="home-sec" aria-busy="true" aria-label="Your tennis circle">
        <div className="home-sec__head">
          <h2 className="home-sec__title">Your tennis circle</h2>
        </div>
        <div className="home-card home-skeleton" aria-hidden="true">
          <span className="home-skeleton__line home-skeleton__line--short" />
          <span className="home-skeleton__line" />
          <span className="home-skeleton__line home-skeleton__line--short" />
        </div>
      </section>
    );
  }

  const shown = expanded ? rows : rows.slice(0, PREVIEW_COUNT);
  const hidden = rows.length - shown.length;

  return (
    <section className="home-sec home-circle" aria-labelledby="home-circle-title">
      <div className="home-sec__head">
        <h2 id="home-circle-title" className="home-sec__title">
          Your tennis circle
        </h2>
        <Link className="home-sec__link" to="/settings/profile?tab=circle">
          Manage
        </Link>
      </div>

      <div className="home-circle__list">
        {shown.map((row, index) => {
          const onClick = () => track(ANALYTICS_EVENTS.homeCircleClick, { kind: row.kind, position: index });
          const card = row.classCard;
          if (card) {
            // A coach's class: what it is and how well it fits, then the price and Book.
            return (
              <article key={row.key} className="home-card home-circle__class">
                <div className="home-circle__class-top">
                  <CircleAvatar row={row} />
                  <span className="home-circle__body">
                    <span className="home-circle__chips">
                      <span className="home-chip home-chip--group">Group lesson</span>
                      {row.chip ? <span className="home-chip home-chip--success">{row.chip}</span> : null}
                    </span>
                    <span className="home-circle__title">{row.title}</span>
                    {card.whenLabel ? <span className="home-circle__when">{card.whenLabel}</span> : null}
                    {card.venueCoach ? <span className="home-circle__when">{card.venueCoach}</span> : null}
                  </span>
                </div>
                <div className="home-circle__class-foot">
                  {card.price ? <span className="home-circle__price">{card.price}</span> : null}
                  {card.spotsChip ? <span className="home-chip home-chip--urgent">{card.spotsChip}</span> : null}
                  <Link className="home-btn home-btn--fill home-circle__book" to={row.href} onClick={onClick}>
                    {row.cta}
                  </Link>
                </div>
              </article>
            );
          }
          return (
            <article key={row.key} className="home-card home-circle__match">
              <CircleAvatar row={row} />
              <span className="home-circle__body">
                <span className="home-tag home-tag--match">{row.eyebrow}</span>
                <span className="home-circle__title">{row.title}</span>
                {row.when ? <span className="home-circle__when">{row.when}</span> : null}
                {row.detail ? <span className="home-circle__when">{row.detail}</span> : null}
              </span>
              <Link className="home-btn home-btn--outline home-btn--small" to={row.href} onClick={onClick}>
                {row.cta}
              </Link>
            </article>
          );
        })}
      </div>

      {hidden > 0 || expanded ? (
        <button type="button" className="home-sec__more" onClick={() => setExpanded((on) => !on)}>
          {expanded ? "Show fewer" : `See all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
