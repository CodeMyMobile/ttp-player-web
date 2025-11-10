import "../coaches/coaches.css";
import "./players.css";

const PlayerCardSkeleton = () => {
  return (
    <div className="fc-card fp-card fp-card--skeleton" aria-hidden="true">
      <div className="fp-card__header">
        <div className="fp-card__identity-block">
          <span className="fp-skeleton fp-skeleton--avatar" />
          <div className="fp-card__profile-skeleton">
            <span className="fp-skeleton fp-skeleton--line fp-skeleton--line-lg" />
            <span className="fp-skeleton fp-skeleton--pill" />
          </div>
        </div>
        <span className="fp-skeleton fp-skeleton--paragraph" />
      </div>

      <div className="fp-card__sections fp-card__sections--skeleton">
        <span className="fp-skeleton fp-skeleton--section" />
        <span className="fp-skeleton fp-skeleton--section" />
      </div>

      <div className="fp-card__actions fp-card__actions--skeleton">
        <span className="fp-skeleton fp-skeleton--action" />
        <span className="fp-skeleton fp-skeleton--action" />
      </div>
    </div>
  );
};

export default PlayerCardSkeleton;
