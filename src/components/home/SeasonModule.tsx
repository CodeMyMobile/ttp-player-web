import { Link } from "react-router-dom";
import type { HomeSeason } from "../../hooks/useHomeStatus";

interface SeasonModuleProps {
  seasons: HomeSeason[];
}

const weeksLabel = (weeks: number | null): string | null => {
  if (weeks === null) return null;
  if (weeks <= 0) return "Final week";
  return `${weeks} week${weeks === 1 ? "" : "s"} left`;
};

/**
 * One card per running season, nearest deadline first.
 *
 * The mockups draw a single card, but a player can be in concurrent leagues, and
 * their deadlines differ — so each keeps its own progress bar, weeks-left and
 * CTA rather than one being hidden behind a switcher.
 *
 * No standing here. Position lives in the rating tile and is not league-scoped;
 * repeating a league-scoped rank beside it would be two numbers that disagree.
 */
export function SeasonModule({ seasons }: SeasonModuleProps) {
  if (!seasons.length) return null;

  return (
    <section className="home-season">
      {seasons.map((season) => {
        const { matchesPlayed = 0, matchesTotal = 0, preSeason } = season.enrichment;
        // No fixtures and no standings means the season has not started. A bar
        // at zero would read as "you are behind" rather than "nothing yet".
        const hasProgress = !preSeason && matchesTotal > 0;
        const percent = hasProgress ? Math.round((matchesPlayed / matchesTotal) * 100) : null;
        const weeks = weeksLabel(season.weeksLeft);

        const meta = [
          hasProgress ? `${matchesPlayed} of ${matchesTotal} matches played` : null,
          season.stillToPlay ? `still to play ${season.stillToPlay}` : null,
        ].filter(Boolean);

        return (
          <article key={season.id} className="home-season__card">
            <div className="home-season__head">
              <h2 className="home-season__name">{season.name || "Season"}</h2>
              {weeks ? <span className="home-season__weeks">{weeks}</span> : null}
            </div>

            {percent !== null ? (
              <div
                className="home-season__bar"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${season.name} progress`}
              >
                <div className="home-season__bar-fill" style={{ width: `${percent}%` }} />
              </div>
            ) : null}

            {preSeason ? (
              <p className="home-season__meta">Fixtures aren’t out yet</p>
            ) : meta.length ? (
              <p className="home-season__meta">{meta.join(" · ")}</p>
            ) : null}

            <Link className="home-season__cta" to={`/leagues/${season.id}/match-browser`}>
              Arrange next match
            </Link>
          </article>
        );
      })}
    </section>
  );
}
