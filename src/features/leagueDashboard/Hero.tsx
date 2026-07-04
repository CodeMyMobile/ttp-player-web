// Personalized violet hero — badge, headline, sub, primary CTA + projected-rank
// chip, and the big rank stat. All fields come from usePlayer's derived hero.
// Gray tone (archived / season complete) swaps the violet fill for a slate gradient.

import Icon from "./Icon";
import type { ViewerHero } from "./types";

interface HeroProps {
  hero: ViewerHero;
  onCta: () => void;
}

const Hero = ({ hero, onCta }: HeroProps) => (
  <section className={`hero tone-${hero.tone}`} aria-live="polite">
    <div className="body">
      <span className="badge">{hero.badge}</span>
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
    <div className="stat">
      <div className="n">{hero.rankStat}</div>
      <div className="l">{hero.rankLabel}</div>
    </div>
  </section>
);

export default Hero;
