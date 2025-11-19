import "../coaches/coaches.css";
import "./players.css";

const PlayerCardSkeleton = () => {
  return (
    <div className="fc-card fp-card fp-card--skeleton" aria-hidden="true">
      <div className="fp-card__header">
        <div className="fp-card__identity-block">
          <div className="fp-card__identity-media">
            <span className="fp-skeleton fp-skeleton--avatar" />
          </div>
          <div className="fp-card__profile-skeleton">
            <span className="fp-skeleton fp-skeleton--line fp-skeleton--line-lg" />
            <div className="fp-card__badge-stack">
              <span className="fp-skeleton fp-skeleton--pill" />
              <span className="fp-skeleton fp-skeleton--pill fp-skeleton--pill-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="fp-card__sections fp-card__sections--skeleton">
        <div className="fp-card__section fp-card__section--bio fp-card__bio-skeleton">
          <span className="fp-skeleton fp-skeleton--bio-line" />
          <span className="fp-skeleton fp-skeleton--bio-line-short" />
        </div>
        <div className="fp-card__section fp-card__section--availability fp-card__availability-skeleton">
          <span className="fp-skeleton fp-skeleton--section-label" />
          <div className="fp-card__availability-skeleton-row">
            <span className="fp-skeleton fp-skeleton--availability-chip" />
            <span className="fp-skeleton fp-skeleton--availability-chip" />
            <span className="fp-skeleton fp-skeleton--availability-chip" />
          </div>
        </div>
        <div className="fp-card__section fp-card__section--skeleton">
          <span className="fp-skeleton fp-skeleton--section-label" />
          <div className="fp-card__location-skeleton-list">
            <div className="fp-card__location-skeleton-item">
              <span className="fp-skeleton fp-skeleton--location-icon" />
              <span className="fp-skeleton fp-skeleton--location-line" />
            </div>
            <div className="fp-card__location-skeleton-item">
              <span className="fp-skeleton fp-skeleton--location-icon" />
              <span className="fp-skeleton fp-skeleton--location-line fp-skeleton--location-line-short" />
            </div>
          </div>
        </div>
      </div>

      <div className="fp-card__actions fp-card__actions--skeleton">
        <span className="fp-skeleton fp-skeleton--action" />
        <span className="fp-skeleton fp-skeleton--action" />
      </div>
    </div>
  );
};

export default PlayerCardSkeleton;
