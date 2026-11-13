import { useState } from "react";
import { ChevronRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import type { HomeSeason } from "../../hooks/useHomeStatus";
import { ACTION_PREVIEW_COUNT, type ActionRow } from "../../utils/homeActionNeeded";
import { ratingPrompt } from "../../utils/ratingPrompt";
import type { RatingState } from "../../utils/homeTiles";

interface ActionNeededProps {
  seasons: HomeSeason[];
  rows: ActionRow[];
  ratingState: RatingState;
  declaredLevel: number | null;
  loading: boolean;
}

const weeksLabel = (weeks: number | null): string | null => {
  if (weeks === null) return null;
  if (weeks <= 0) return "Final week";
  return `${weeks} week${weeks === 1 ? "" : "s"} left`;
};

/**
 * "Action needed": the player's running leagues, the confirm-rating card while they're
 * unrated, then invites and rackets ready for pickup, soonest deadline first, three before
 * "See all". Renders nothing when there's nothing to do.
 *
 * League progress comes from utils/leagueSeason (via useActiveSeasons), shared with the
 * leagues page, so the two screens can't disagree about how far through a season someone is.
 */
export function ActionNeeded({ seasons, rows, ratingState, declaredLevel, loading }: ActionNeededProps) {
  const [expanded, setExpanded] = useState(false);
  // Rated players get no card: the ladder lives in the Play tab. "unknown" (loading, or the
  // call failed) says nothing rather than telling a rated player to get rated.
  const prompt = ratingState === "unrated" ? ratingPrompt(declaredLevel) : null;
  const shown = expanded ? rows : rows.slice(0, ACTION_PREVIEW_COUNT);
  const hidden = rows.length - shown.length;

  if (!seasons.length && !prompt && !rows.length) {
    if (!loading) return null;
    return (
      <section className="home-sec" aria-busy="true" aria-label="Action needed">
        <div className="home-sec__head">
          <h2 className="home-sec__title">Action needed</h2>
        </div>
        <div className="home-card home-skeleton" aria-hidden="true">
          <span className="home-skeleton__line home-skeleton__line--short" />
          <span className="home-skeleton__line" />
        </div>
      </section>
    );
  }

  return (
    <section className="home-sec home-action" aria-labelledby="home-action-title">
      <div className="home-sec__head">
        <h2 id="home-action-title" className="home-sec__title">
          Action needed
        </h2>
      </div>

      <div className="home-action__stack">
        {seasons.map((season) => {
          const { matchesPlayed = 0, matchesTotal = 0, preSeason } = season.enrichment;
          // No fixtures yet means the season hasn't started: a bar at zero would read as
          // "you're behind" rather than "nothing yet".
          const hasProgress = !preSeason && matchesTotal > 0;
          const percent = hasProgress ? Math.round((matchesPlayed / matchesTotal) * 100) : null;
          const weeks = weeksLabel(season.weeksLeft);
          return (
            <article key={season.id} className="home-card home-league">
              <div className="home-league__head">
                <div className="home-league__name-wrap">
                  <span className="home-tag home-tag--league">League</span>
                  <h3 className="home-league__name">{season.name || "Season"}</h3>
                </div>
                {weeks ? <span className="home-chip home-chip--urgent">{weeks}</span> : null}
              </div>

              {percent !== null ? (
                <div className="home-league__progress">
                  <div className="home-league__counts">
                    <span>
                      {matchesPlayed} of {matchesTotal} played
                    </span>
                    <span className="home-league__to-go">{matchesTotal - matchesPlayed} to go</span>
                  </div>
                  <div
                    className="home-league__bar"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${season.name} progress`}
                  >
                    <div className="home-league__bar-fill" style={{ width: `${Math.max(percent, 2)}%` }} />
                  </div>
                </div>
              ) : null}

              {preSeason ? (
                <p className="home-league__meta">Fixtures aren’t out yet</p>
              ) : season.stillToPlay ? (
                <p className="home-league__meta">Still to play {season.stillToPlay}</p>
              ) : null}

              {/* The league dashboard: arranging a match starts from where the season
                  stands, and the arrange flow lives there. */}
              <Link className="home-btn home-btn--fill" to={`/leagues/${season.id}/dashboard`}>
                Arrange a match
              </Link>
            </article>
          );
        })}

        {prompt ? (
          <article className="home-card home-rating">
            <span className="home-rating__icon" aria-hidden="true">
              <Trophy size={22} strokeWidth={2} />
            </span>
            <span className="home-rating__copy">
              <span className="home-rating__title">{prompt.title}</span>
              <span className="home-rating__sub">{prompt.sub}</span>
            </span>
            {/* Match play has no rated-only filter to link to, so this opens match play. */}
            <Link className="home-btn home-btn--outline home-rating__cta" to={prompt.href}>
              {declaredLevel === null ? "Start" : "Find one"}
            </Link>
          </article>
        ) : null}

        {shown.length ? (
          <ul className="home-card home-action__rows">
            {shown.map((row) => (
              <li key={row.key} className="home-action__row">
                <span className="home-action__copy">
                  <span className="home-action__title">{row.title}</span>
                  {row.detail ? <span className="home-action__detail">{row.detail}</span> : null}
                </span>
                {row.href ? (
                  <Link className="home-btn home-btn--outline home-btn--small" to={row.href}>
                    {row.cta}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {hidden > 0 || expanded ? (
          <button type="button" className="home-sec__more" onClick={() => setExpanded((on) => !on)}>
            {expanded ? "Show fewer" : `See all ${rows.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
