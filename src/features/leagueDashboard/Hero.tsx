// Personalized violet hero — badge, headline, sub, primary CTA + projected-rank
// chip, and the big rank stat. All fields come from usePlayer's derived hero.
// Gray tone (archived / season complete) swaps the violet fill for a slate gradient.

import { Link } from "react-router-dom";

import Icon from "./Icon";
import type { ViewerHero } from "./types";

/** The never-played hero's clinic prompt. Behind VITE_LEAGUE_COACHING_PROMPTS. */
export interface HeroClinic {
  /** "4.0". */
  level: string;
  /** Router state that opens the lessons page filtered to the level. */
  linkState: unknown;
  onClick: () => void;
}

interface HeroProps {
  hero: ViewerHero;
  onCta: () => void;
  /** Mobile-only action for the never-played state ("Post your availability").
   *  Desktop keeps its own `.cta`; this drives the mobile-only `.hero__np-cta`. */
  onPostAvailability?: () => void;
  /** Shown only while the viewer is unranked; never once they have a result. */
  clinic?: HeroClinic | null;
}

const Hero = ({ hero, onCta, onPostAvailability, clinic = null }: HeroProps) => {
  // Unranked / never-played viewers: the rank stat is a placeholder "—", which
  // renders as an empty white bar, and the "New player" badge just echoes the
  // headline. Drop both for that state and keep the single headline signal.
  const isUnranked = hero.rankStat === "—";
  return (
    <section className={`hero tone-${hero.tone}`} aria-live="polite">
      <div className="body">
        {isUnranked ? null : <span className="badge">{hero.badge}</span>}
        <h2>{hero.headline}</h2>
        <p>{hero.sub}</p>
        <div className="cta-row">
          <button type="button" className="cta" onClick={onCta}>
            {hero.ctaLabel}
          </button>
          {isUnranked ? (
            <button type="button" className="hero__np-cta" onClick={onPostAvailability}>
              Post your availability
            </button>
          ) : null}
          {/* Desktop only: mobile already has two hero actions, so it gets the text link below. */}
          {isUnranked && clinic ? (
            <Link className="hero__clinic-btn" to="/group-lessons" state={clinic.linkState} onClick={clinic.onClick}>
              Warm up in a {clinic.level} clinic
            </Link>
          ) : null}
          <span className="chip">
            <Icon name="trending-up" />
            {hero.projectedChip}
          </span>
        </div>
        {isUnranked && clinic ? (
          <Link className="hero__clinic-link" to="/group-lessons" state={clinic.linkState} onClick={clinic.onClick}>
            Not ready? Warm up in a {clinic.level} clinic →
          </Link>
        ) : null}
      </div>
      {isUnranked ? null : (
        <div className="stat">
          <div className="n">{hero.rankStat}</div>
          <div className="l">{hero.rankLabel}</div>
        </div>
      )}
    </section>
  );
};

export default Hero;
