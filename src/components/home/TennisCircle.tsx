import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import { usableAvatar } from "../../utils/avatar";
import type { CircleRow } from "../../utils/homeCircle";

const PREVIEW_COUNT = 3;

interface TennisCircleProps {
  rows: CircleRow[];
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
 * "Your tennis circle": open matches people the player knows are in, and classes from
 * their coaches. Rows and wording come from utils/homeCircle; this only draws them.
 * Hidden when there's nothing, so a player with no history sees no empty box.
 */
export function TennisCircle({ rows }: TennisCircleProps) {
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

  if (!rows.length) return null;

  const shown = expanded ? rows : rows.slice(0, PREVIEW_COUNT);
  const hidden = rows.length - shown.length;

  return (
    <section className="home-circle" aria-label="Your tennis circle">
      <header className="home-circle__head">
        <h2 className="home-circle__heading">Your tennis circle</h2>
        <p className="home-circle__sub">Games with people you know, and classes from your coaches</p>
      </header>

      <div className="home-circle__list">
        {shown.map((row, index) => (
          <article key={row.key} className={`home-circle__card home-circle__card--${row.kind}`}>
            <CircleAvatar row={row} />
            <span className="home-circle__body">
              <span className="home-circle__eyebrow">
                {row.eyebrow}
                {row.chip ? <span className="home-circle__chip">{row.chip}</span> : null}
              </span>
              <span className="home-circle__title">{row.title}</span>
              {row.when ? <span className="home-circle__when">{row.when}</span> : null}
              {row.detail ? <span className="home-circle__detail">{row.detail}</span> : null}
            </span>
            <Link
              className="home-circle__cta"
              to={row.href}
              onClick={() => track(ANALYTICS_EVENTS.homeCircleClick, { kind: row.kind, position: index })}
            >
              {row.cta}
            </Link>
          </article>
        ))}
      </div>

      {hidden > 0 || expanded ? (
        <button type="button" className="home-circle__more" onClick={() => setExpanded((on) => !on)}>
          {expanded ? "Show fewer" : `See all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
