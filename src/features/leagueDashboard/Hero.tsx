// Personalized violet hero — badge, headline, sub, primary CTA + projected-rank
// chip, and the big rank stat. All fields come from usePlayer's derived hero.
// Gray tone (archived / season complete) swaps the violet fill for a slate gradient.

import Icon from "./Icon";
import type { ViewerHero } from "./types";

interface HeroProps {
  hero: ViewerHero;
  onCta: () => void;
}

const Hero = ({ hero, onCta }: HeroProps) => {
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
          <span className="chip">
            <Icon name="trending-up" />
            {hero.projectedChip}
          </span>
        </div>
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
