import "../coaches/coaches.css";
import "./players.css";

const PlayerCardSkeleton = () => {
  return (
    <div className="fc-card fp-card fp-card--skeleton" aria-hidden="true">
      <div className="fp-card__top">
        <div className="fp-skeleton fp-skeleton--pill-row">
          <span className="fp-skeleton fp-skeleton--pill" />
          <span className="fp-skeleton fp-skeleton--pill" />
        </div>
        <span className="fp-skeleton fp-skeleton--rating" />
      </div>

      <div className="fp-card__profile">
        <span className="fp-skeleton fp-skeleton--avatar" />
        <div className="fp-card__profile-skeleton">
          <span className="fp-skeleton fp-skeleton--line fp-skeleton--line-lg" />
          <span className="fp-skeleton fp-skeleton--line" />
          <span className="fp-skeleton fp-skeleton--line" />
        </div>
      </div>

      <span className="fp-skeleton fp-skeleton--paragraph" />
      <span className="fp-skeleton fp-skeleton--meta" />
      <span className="fp-skeleton fp-skeleton--banner" />
      <span className="fp-skeleton fp-skeleton--actions" />
    </div>
  );
};

export default PlayerCardSkeleton;
